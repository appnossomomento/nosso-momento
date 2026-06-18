import { expect, type Page } from '@playwright/test';

export interface UserBCredentials {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  sexo: string;
}

export function getUserACredentials(): { email: string; password: string } {
  const email = process.env.E2E_USER_A_EMAIL;
  const password = process.env.E2E_USER_A_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Defina E2E_USER_A_EMAIL e E2E_USER_A_PASSWORD antes de rodar o teste (conta não pareada recomendada).'
    );
  }
  return { email, password };
}

export function generateUserB(): UserBCredentials {
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7).padStart(7, '0');
  return {
    nome: `E2E Parceiro ${stamp}`,
    email: `e2e+${stamp}@nossomomento.test`,
    telefone: `1199${suffix}`,
    senha: `E2eTest${String(stamp).slice(-6)}!`,
    sexo: 'masculino',
  };
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);

  const emailInput = page.getByPlaceholder('Email');
  const senhaInput = page.getByPlaceholder('Senha');
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(email);
  await senhaInput.fill(password);

  await expect(emailInput).toHaveValue(email, { timeout: 5_000 });

  await dismissPwaPromptIfPresent(page);
  await page.getByRole('button', { name: /LOGIN/i }).click({ force: true });

  try {
    await page.waitForURL(/\/(parear|dashboard|parceiro)/, { timeout: 90_000 });
  } catch {
    await dismissAlertIfPresent(page);
    await dismissPwaPromptIfPresent(page);
    await emailInput.fill(email);
    await senhaInput.fill(password);
    await page.getByRole('button', { name: /LOGIN/i }).click({ force: true });
    await page.waitForURL(/\/(parear|dashboard|parceiro)/, { timeout: 90_000 });
  }
}

export async function preencherCadastro(page: Page, user: UserBCredentials): Promise<void> {
  await page.getByPlaceholder('Nome completo').fill(user.nome);
  await page.getByPlaceholder('Email').fill(user.email);
  await page.getByPlaceholder(/Telefone/i).fill(user.telefone);
  await page.getByPlaceholder(/Senha/i).fill(user.senha);
  await page.locator('select').selectOption(user.sexo);
  await page.locator('#aceitarTermos').check();
  await page.getByRole('button', { name: /CRIAR CONTA/i }).click();
}

export async function cadastroComConvite(page: Page, user: UserBCredentials): Promise<void> {
  await page.getByRole('link', { name: /CRIAR CONTA/i }).click();
  await page.waitForURL(/\/cadastro/, { timeout: 15_000 });
  await preencherCadastro(page, user);
}

export async function waitForPairing(page: Page, timeoutMs = 45_000): Promise<void> {
  await page.waitForURL(/\/(dashboard|parceiro)/, { timeout: timeoutMs });
  await expect(page).not.toHaveURL(/\/parear/);
}

export async function dismissAlertIfPresent(page: Page): Promise<void> {
  const okButton = page.getByRole('button', { name: /^OK$/i });
  if (await okButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await okButton.click();
  }
}

export async function dismissPwaPromptIfPresent(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: /Instalar aplicativo/i });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await dialog.isVisible({ timeout: 1_000 }).catch(() => false))) return;
    const agoraNao = dialog.getByRole('button', { name: /Agora não/i });
    if (await agoraNao.isVisible().catch(() => false)) {
      await agoraNao.click({ force: true });
    } else {
      const fechar = dialog.getByRole('button', { name: /^Fechar$/i });
      if (await fechar.count()) await fechar.first().click({ force: true });
    }
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

async function irParaParceiro(page: Page): Promise<void> {
  await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);
  await dismissChallengePopupIfPresent(page);
  if (!page.url().includes('/parceiro')) {
    await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
    await dismissPwaPromptIfPresent(page);
  }
}

/** Garante /parceiro sem popup de desafio bloqueando (pode haver fila de desafios). */
async function ensureParceiroPageReady(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    if (!page.url().includes('/parceiro')) {
      await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
    }
    await dismissPwaPromptIfPresent(page);

    const overlay = page.locator('div.fixed.inset-0').filter({ hasText: 'Desafio da Semana' }).first();
    if (await overlay.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await dismissChallengePopupIfPresent(page);
      await page.waitForTimeout(800);
      continue;
    }

    const desfazer = page.getByRole('button', { name: /Desfazer Pareamento/i });
    if (await desfazer.isVisible({ timeout: 3_000 }).catch(() => false)) {
      return;
    }

    await page.waitForTimeout(500);
  }

  await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);
}

export async function dismissChallengePopupIfPresent(page: Page): Promise<void> {
  const overlay = page.locator('div.fixed.inset-0').filter({ hasText: 'Desafio da Semana' }).first();
  if (!(await overlay.isVisible({ timeout: 2_000 }).catch(() => false))) return;

  const fechar = overlay.getByRole('button', { name: /^Fechar$/i });
  if (await fechar.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await fechar.click({ force: true });
    await overlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    if (!page.url().includes('/parceiro')) {
      await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
      await dismissPwaPromptIfPresent(page);
    }
    return;
  }

  const girar = overlay.getByRole('button', { name: /Girar Roleta/i });
  if (await girar.isVisible({ timeout: 1_000 }).catch(() => false)) {
    if (await girar.isEnabled().catch(() => false)) {
      await girar.click();
      await fechar.waitFor({ state: 'visible', timeout: 25_000 }).catch(() => {});
    }
    if (await fechar.isVisible().catch(() => false)) {
      await fechar.click({ force: true });
      await overlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    }
    if (!page.url().includes('/parceiro')) {
      await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
      await dismissPwaPromptIfPresent(page);
    }
    return;
  }

  const perguntaInput = overlay.getByPlaceholder('Sua resposta...');
  if (await perguntaInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
    if (await perguntaInput.isEnabled().catch(() => false)) {
      await perguntaInput.fill('TESTE');
      const enviar = overlay.getByRole('button', { name: /Enviar Resposta/i });
      if (await enviar.isEnabled({ timeout: 8_000 }).catch(() => false)) {
        await enviar.click({ force: true });
      } else {
        await perguntaInput.press('Enter');
      }
    }
    await overlay.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    if (await overlay.isVisible().catch(() => false) && (await fechar.isVisible().catch(() => false))) {
      await fechar.click({ force: true });
    }
    if (!page.url().includes('/parceiro')) {
      await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
      await dismissPwaPromptIfPresent(page);
    }
    return;
  }

  const escolha = overlay.locator('.grid.grid-cols-2 button').first();
  if (await escolha.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await escolha.click();
    const confirmar = overlay.getByRole('button', { name: /Confirmar Escolha/i });
    if (await confirmar.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await confirmar.click({ force: true });
    }
    await overlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    if (!page.url().includes('/parceiro')) {
      await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
      await dismissPwaPromptIfPresent(page);
    }
  }
}

function conviteButton(page: Page) {
  return page.locator('button').filter({ hasText: /Convide seu amor|Gerar e copiar link/i }).first();
}

/** Garante que o Usuário A está despareado e na tela /parear (idempotente). */
export async function garantirUsuarioADespareado(page: Page): Promise<void> {
  const conviteBtn = conviteButton(page);

  await page.goto('/parear', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);
  if (await conviteBtn.isVisible({ timeout: 10_000 }).catch(() => false)) return;

  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureParceiroPageReady(page);

    const desfazerBtn = page.getByRole('button', { name: /Desfazer Pareamento/i });
    try {
      await desfazerBtn.waitFor({ state: 'attached', timeout: 15_000 });
    } catch {
      await page.goto('/parear', { waitUntil: 'domcontentloaded' });
      if (await conviteBtn.isVisible({ timeout: 10_000 }).catch(() => false)) return;
      continue;
    }

    await desfazerBtn.scrollIntoViewIfNeeded();
    await expect(desfazerBtn).toBeVisible({ timeout: 10_000 });

    const modalMsg = page.getByText(/Tem certeza que quer desfazer o pareamento/i);
    for (let clickAttempt = 0; clickAttempt < 3; clickAttempt++) {
      await ensureParceiroPageReady(page);
      await dismissPwaPromptIfPresent(page);
      const btn = page.getByRole('button', { name: /Desfazer Pareamento/i });
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click({ force: true });
      if (await modalMsg.isVisible({ timeout: 2_000 }).catch(() => false)) break;
      await page.waitForTimeout(600);
    }
    await expect(modalMsg).toBeVisible({ timeout: 15_000 });
    await dismissPwaPromptIfPresent(page);
    const confirmar = page.getByRole('button', { name: 'Desfazer', exact: true });
    await expect(confirmar).toBeVisible({ timeout: 10_000 });
    await confirmar.click({ force: true });

    for (let wait = 0; wait < 12; wait++) {
      await page.waitForTimeout(5_000);
      await page.goto('/parear', { waitUntil: 'domcontentloaded' });
      await dismissPwaPromptIfPresent(page);
      if (await conviteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return;
    }

    await page.waitForTimeout(2_000);
    await page.goto('/parear', { waitUntil: 'domcontentloaded' });
    await dismissPwaPromptIfPresent(page);
    if (await conviteBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;

    const parearLink = page.getByRole('link', { name: /Ir para Pareamentos|Parear agora/i });
    if (await parearLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await parearLink.click();
      await page.waitForURL(/\/parear/, { timeout: 30_000 });
      await dismissPwaPromptIfPresent(page);
      if (await conviteBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    }
  }

  await page.goto('/parear', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);
  await expect(conviteBtn).toBeVisible({ timeout: 30_000 });
}
