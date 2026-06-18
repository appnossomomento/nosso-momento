import { test, expect, type Browser, type Page } from '@playwright/test';
import * as path from 'path';
import { LogCollector } from './helpers/logCollector';
import {
  generateUserB,
  getUserACredentials,
  login,
  preencherCadastro,
  waitForPairing,
  dismissAlertIfPresent,
  garantirUsuarioADespareado,
  dismissPwaPromptIfPresent,
  responderDesafioSeAparecer,
  dismissChallengePopupIfPresent,
} from './helpers/auth';
import { createE2eContext } from './helpers/context';

const collector = new LogCollector();
let reportPaths: { json: string; md: string } | null = null;

function attachCollector(page: Page, label: string) {
  collector.attach(page, label);
}

async function gerarConviteUsuarioA(page: Page): Promise<string> {
  await garantirUsuarioADespareado(page);
  await dismissPwaPromptIfPresent(page);

  const inviteButton = page.locator('button').filter({ hasText: /Convide seu amor|Gerar e copiar link/i }).first();
  await expect(inviteButton).toBeVisible({ timeout: 15_000 });
  await inviteButton.click();

  const linkBox = page.locator('text=Link gerado').locator('..').locator('p').last();
  await expect(linkBox).toBeVisible({ timeout: 30_000 });
  const conviteUrl = (await linkBox.textContent())?.trim() ?? '';
  expect(conviteUrl).toMatch(/\/convite\/[a-f0-9]{40}/);
  return conviteUrl;
}

async function registrarClima(page: Page): Promise<void> {
  await page.goto('/parceiro');
  await page.waitForLoadState('domcontentloaded');
  await dismissPwaPromptIfPresent(page);
  await dismissChallengePopupIfPresent(page);

  const humorBtn = page.locator('.termometro-btn, button').filter({ hasText: /Muito Feliz|Feliz|Normal|Triste/ }).first();
  if (await humorBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await humorBtn.click({ force: true });
    await page.waitForTimeout(1_500);
  }
}

async function resgatarMomentoLoja(page: Page): Promise<boolean> {
  await page.goto('/loja');
  await page.waitForLoadState('domcontentloaded');

  const resgatar = page.getByRole('button', { name: /^Resgatar$/i }).first();
  if (!(await resgatar.isVisible({ timeout: 15_000 }).catch(() => false))) {
    return false;
  }
  if (await resgatar.isDisabled().catch(() => true)) {
    return false;
  }

  await resgatar.click();
  await expect(page.getByText('Meu carrinho')).toBeVisible({ timeout: 10_000 });

  const finalizar = page.getByRole('button', { name: /Finalizar Pedido/i });
  await finalizar.click();

  const confirmar = page.getByRole('button', { name: /^Confirmar$/i });
  await expect(confirmar).toBeVisible({ timeout: 5_000 });
  await confirmar.click();

  await page.waitForTimeout(3_000);
  return true;
}

async function completarMomentoSeHouver(page: Page): Promise<void> {
  await page.goto('/momentos');
  await page.waitForLoadState('domcontentloaded');

  const enviadosTab = page.getByRole('button', { name: /enviados/i });
  await enviadosTab.click();

  const feitoBtn = page.getByRole('button', { name: /Feito/i }).first();
  if (!(await feitoBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return;
  }

  await feitoBtn.click();
  const confirmar = page.getByRole('button', { name: /Confirmar sem Foto/i });
  await expect(confirmar).toBeVisible({ timeout: 10_000 });
  await confirmar.click();
  await page.waitForTimeout(2_000);
}

async function smokeRotas(page: Page, rotas: string[]): Promise<void> {
  for (const rota of rotas) {
    const response = await page.goto(rota);
    expect(response?.status(), `rota ${rota} deve carregar`).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await dismissAlertIfPresent(page);
  }
}

test.describe.serial('Jornada completa — novo usuário via convite', () => {
  let browser: Browser;
  let conviteUrl = '';
  const userB = generateUserB();
  const journeyMeta: Record<string, unknown> = {
    userA: process.env.E2E_USER_A_EMAIL ?? '(não definido)',
    userBEmail: userB.email,
    conviteUrl: '',
    pairingOk: false,
    lojaResgateOk: false,
    momentoCompletoOk: false,
    desafioOk: false,
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    getUserACredentials();
  });

  test.afterAll(async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(process.cwd(), 'e2e', 'reports');
    const jsonPath = path.join(reportsDir, `jornada-${stamp}.json`);
    const mdPath = path.join(reportsDir, `jornada-${stamp}.md`);
    collector.saveReport(jsonPath, journeyMeta);
    collector.saveMarkdown(mdPath, journeyMeta);
    reportPaths = { json: jsonPath, md: mdPath };

    const critical = collector.getCritical();
    console.log('\n========== RELATÓRIO E2E ==========');
    console.log(`JSON: ${jsonPath}`);
    console.log(`MD:   ${mdPath}`);
    console.log(`Críticos: ${critical.length} | Avisos: ${collector.getWarnings().length}`);
    if (critical.length > 0) {
      for (const e of critical) {
        console.log(`  [CRITICAL][${e.page}] ${e.message}`);
      }
    }
    console.log('====================================\n');
  });

  test('Fase 1 — Usuário A faz login e gera convite', async () => {
    test.setTimeout(240_000);
    const { email, password } = getUserACredentials();
    const contextA = await createE2eContext(browser);
    const pageA = await contextA.newPage();
    attachCollector(pageA, 'UsuarioA');

    await login(pageA, email, password);
    conviteUrl = await gerarConviteUsuarioA(pageA);
    journeyMeta.conviteUrl = conviteUrl;

    await contextA.close();
  });

  test('Fase 2 — Usuário B aceita convite, cadastra e pareia', async () => {
    expect(conviteUrl).toMatch(/\/convite\//);

    const contextB = await createE2eContext(browser);
    const pageB = await contextB.newPage();
    attachCollector(pageB, 'UsuarioB');

    await pageB.goto(conviteUrl);
    await pageB.getByRole('link', { name: /CRIAR CONTA/i }).click();
    await pageB.waitForURL(/\/cadastro/, { timeout: 15_000 });
    await preencherCadastro(pageB, userB);
    await waitForPairing(pageB, 60_000);
    journeyMeta.pairingOk = true;

    await contextB.close();
  });

  test('Fase 3 — Pós-pareamento: desafio, clima, loja, momentos', async () => {
    test.setTimeout(300_000);
    const contextB = await createE2eContext(browser);
    const pageB = await contextB.newPage();
    attachCollector(pageB, 'UsuarioB-pos');

    await login(pageB, userB.email, userB.senha);
    await pageB.waitForURL(/\/(dashboard|parceiro|parear)/, { timeout: 90_000 });
    await dismissPwaPromptIfPresent(pageB);

    await responderDesafioSeAparecer(pageB);
    await dismissPwaPromptIfPresent(pageB);
    await dismissChallengePopupIfPresent(pageB);
    journeyMeta.desafioOk = true;
    await registrarClima(pageB);

    const resgatou = await resgatarMomentoLoja(pageB);
    journeyMeta.lojaResgateOk = resgatou;

    if (resgatou) {
      await pageB.waitForTimeout(5_000);
      await completarMomentoSeHouver(pageB);
      journeyMeta.momentoCompletoOk = true;
    }

    await contextB.close();
  });

  test('Fase 4 — Smoke das rotas principais (Usuário B)', async () => {
    const contextB = await createE2eContext(browser);
    const pageB = await contextB.newPage();
    attachCollector(pageB, 'UsuarioB-smoke');

    await login(pageB, userB.email, userB.senha);
    await smokeRotas(pageB, ['/dashboard', '/notificacoes', '/memorias', '/parceiro']);

    await contextB.close();
  });

  test('Fase 5 — Relatório sem erros críticos', async () => {
    const critical = collector.getCritical();
    if (critical.length > 0 && reportPaths) {
      console.log(`Relatório salvo em ${reportPaths.json}`);
    }
    expect(
      critical,
      `Encontrados ${critical.length} erro(s) crítico(s). Veja e2e/reports/`
    ).toEqual([]);
  });
});
