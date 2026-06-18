import { test, expect, type Browser } from '@playwright/test';
import * as path from 'path';
import { LogCollector } from './helpers/logCollector';
import {
  generateUserB,
  getUserACredentials,
  login,
  preencherCadastro,
  waitForPairing,
  dismissPwaPromptIfPresent,
  dismissChallengePopupIfPresent,
  garantirUsuarioADespareado,
} from './helpers/auth';
import {
  resgatarMomentoNaLoja,
  aguardarMomentoPendenteEnviados,
  realizarMomentoEnviado,
} from './helpers/momentos';

const collector = new LogCollector();

test.describe.serial('Jornada — resgate e realização de momentos', () => {
  let browser: Browser;
  let conviteUrl = '';
  const userB = generateUserB();
  const meta: Record<string, unknown> = {
    userA: process.env.E2E_USER_A_EMAIL ?? '(não definido)',
    userBEmail: userB.email,
    pairingOk: false,
    resgateOk: false,
    realizacaoOk: false,
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    getUserACredentials();
  });

  test.afterAll(async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(process.cwd(), 'e2e', 'reports');
    const jsonPath = path.join(reportsDir, `jornada-resgate-momentos-${stamp}.json`);
    const mdPath = path.join(reportsDir, `jornada-resgate-momentos-${stamp}.md`);
    collector.saveReport(jsonPath, meta);
    collector.saveMarkdown(mdPath, meta);

    const critical = collector.getCritical();
    console.log('\n========== E2E Resgate Momentos ==========');
    console.log(`JSON: ${jsonPath}`);
    console.log(`Críticos: ${critical.length}`);
    console.log('==========================================\n');
  });

  test('Fase 1 — Parear Usuário A com Usuário B (setup)', async () => {
    test.setTimeout(240_000);
    const { email, password } = getUserACredentials();
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    collector.attach(pageA, 'UsuarioA-setup');

    await login(pageA, email, password);
    await garantirUsuarioADespareado(pageA);

    const inviteButton = pageA.locator('button').filter({ hasText: /Convide seu amor|Gerar e copiar link/i }).first();
    await expect(inviteButton).toBeVisible({ timeout: 15_000 });
    await inviteButton.click();

    const linkBox = pageA.locator('text=Link gerado').locator('..').locator('p').last();
    await expect(linkBox).toBeVisible({ timeout: 30_000 });
    conviteUrl = (await linkBox.textContent())?.trim() ?? '';
    expect(conviteUrl).toMatch(/\/convite\/[a-f0-9]{40}/);
    meta.conviteUrl = conviteUrl;

    await contextA.close();
  });

  test('Fase 2 — Usuário B aceita convite e pareia', async () => {
    test.setTimeout(120_000);
    expect(conviteUrl).toMatch(/\/convite\//);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    collector.attach(pageB, 'UsuarioB-parear');

    await pageB.goto(conviteUrl);
    await pageB.getByRole('link', { name: /CRIAR CONTA/i }).click();
    await pageB.waitForURL(/\/cadastro/, { timeout: 15_000 });
    await preencherCadastro(pageB, userB);
    await waitForPairing(pageB, 60_000);
    meta.pairingOk = true;

    await contextB.close();
  });

  test('Fase 3 — Resgatar, aguardar pendente e realizar momento', async () => {
    test.setTimeout(300_000);
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    collector.attach(pageB, 'UsuarioB-resgate-realizar');

    await login(pageB, userB.email, userB.senha);
    await dismissPwaPromptIfPresent(pageB);
    await dismissChallengePopupIfPresent(pageB);

    const nomeResgatado = await resgatarMomentoNaLoja(pageB);
    meta.momentoResgatado = nomeResgatado;
    meta.resgateOk = true;

    await aguardarMomentoPendenteEnviados(pageB, 90_000);
    await realizarMomentoEnviado(pageB);
    meta.realizacaoOk = true;

    await contextB.close();
  });

  test('Fase 4 — Sem erros críticos no console', async () => {
    const critical = collector.getCritical();
    expect(critical, `Erros críticos: ${critical.length}`).toEqual([]);
  });
});
