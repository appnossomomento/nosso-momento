import { test, expect, type Browser } from '@playwright/test';
import * as path from 'path';
import { LogCollector } from './helpers/logCollector';
import { createE2eContext } from './helpers/context';
import { login, dismissPwaPromptIfPresent } from './helpers/auth';
import {
  aguardarCustomNaPersonalizar,
  aguardarMomentoMestreForaDoCatalogo,
  criarMomentoCustom,
  excluirMomentoMestrePorNome,
  expandirExcluidosSeNecessario,
  getPartnerCredentials,
  getVipUserCredentials,
  irParaLoja,
  irParaPersonalizar,
  obterPrimeiroMomentoMestre,
  salvarCatalogoMestre,
  verificarCustomNaLoja,
  verificarMomentoAusenteNaLoja,
} from './helpers/personalizar';

/**
 * Pré-requisitos (.env.e2e.local ou .env.local):
 *   E2E_VIP_EMAIL / E2E_VIP_PASSWORD — conta VIP já pareada
 *   E2E_PARTNER_EMAIL / E2E_PARTNER_PASSWORD — parceiro da mesma conexão (opcional, valida /loja)
 *   E2E_APPCHECK_DEBUG_TOKEN ou NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN — se App Check enforced
 *
 * Rodar: npm run test:e2e:loja-personalizar
 */
const collector = new LogCollector();

test.describe.serial('Jornada — personalizar loja (excluir mestre + custom)', () => {
  let browser: Browser;
  let nomeMestreExcluido = '';
  let nomeCustom = '';
  const meta: Record<string, unknown> = {
    vipEmail: process.env.E2E_VIP_EMAIL ?? '(não definido)',
    partnerEmail: process.env.E2E_PARTNER_EMAIL ?? '(opcional)',
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    getVipUserCredentials();
    nomeCustom = `E2E Custom ${Date.now()}`;
    meta.nomeCustom = nomeCustom;
  });

  test.afterAll(async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(process.cwd(), 'e2e', 'reports');
    const jsonPath = path.join(reportsDir, `jornada-loja-personalizar-${stamp}.json`);
    const mdPath = path.join(reportsDir, `jornada-loja-personalizar-${stamp}.md`);
    collector.saveReport(jsonPath, meta);
    collector.saveMarkdown(mdPath, meta);

    const critical = collector.getCritical();
    console.log('\n========== E2E Loja Personalizar ==========');
    console.log(`JSON: ${jsonPath}`);
    console.log(`Críticos: ${critical.length}`);
    console.log('===========================================\n');
  });

  test('Fase 1 — VIP exclui momento mestre e salva catálogo', async () => {
    test.setTimeout(180_000);
    const { email, password } = getVipUserCredentials();
    const context = await createE2eContext(browser);
    const page = await context.newPage();
    collector.attach(page, 'VIP-personalizar-excluir');

    await login(page, email, password);
    await dismissPwaPromptIfPresent(page);
    await irParaPersonalizar(page);

    nomeMestreExcluido = await obterPrimeiroMomentoMestre(page);
    meta.mestreExcluido = nomeMestreExcluido;

    await excluirMomentoMestrePorNome(page, nomeMestreExcluido);
    await aguardarMomentoMestreForaDoCatalogo(page, nomeMestreExcluido);

    await salvarCatalogoMestre(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await irParaPersonalizar(page);
    await aguardarMomentoMestreForaDoCatalogo(page, nomeMestreExcluido);
    await expandirExcluidosSeNecessario(page);
    await expect(page.getByText(nomeMestreExcluido, { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    meta.excluirMestreOk = true;
    await context.close();
  });

  test('Fase 2 — VIP cria momento custom', async () => {
    test.setTimeout(180_000);
    const { email, password } = getVipUserCredentials();
    const context = await createE2eContext(browser);
    const page = await context.newPage();
    collector.attach(page, 'VIP-personalizar-custom');

    await login(page, email, password);
    await irParaPersonalizar(page);

    await criarMomentoCustom(page, { nome: nomeCustom, preco: 5 });
    await aguardarCustomNaPersonalizar(page, nomeCustom);

    meta.criarCustomOk = true;
    await context.close();
  });

  test('Fase 3 — Parceiro vê loja sem mestre excluído e com custom', async () => {
    test.setTimeout(120_000);
    const partner = getPartnerCredentials();
    test.skip(!partner, 'E2E_PARTNER_EMAIL/PASSWORD não definidos — pulando validação na /loja');

    const context = await createE2eContext(browser);
    const page = await context.newPage();
    collector.attach(page, 'Parceiro-loja');

    await login(page, partner!.email, partner!.password);
    await irParaLoja(page);

    if (nomeMestreExcluido) {
      await verificarMomentoAusenteNaLoja(page, nomeMestreExcluido);
    }
    await verificarCustomNaLoja(page, nomeCustom);

    meta.lojaParceiroOk = true;
    await context.close();
  });

  test('Fase 4 — Sem erros críticos no console', async () => {
    const critical = collector.getCritical();
    expect(critical, `Erros críticos: ${critical.length}`).toEqual([]);
  });
});
