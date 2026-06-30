import { expect, type Page } from '@playwright/test';
import * as path from 'path';
import {
  dismissAlertIfPresent,
  dismissChallengePopupIfPresent,
  dismissPwaPromptIfPresent,
} from './auth';

export function getVipUserCredentials(): { email: string; password: string } {
  const email = process.env.E2E_VIP_EMAIL;
  const password = process.env.E2E_VIP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Defina E2E_VIP_EMAIL e E2E_VIP_PASSWORD (conta VIP pareada) em .env.e2e.local ou .env.local.',
    );
  }
  return { email, password };
}

export function getPartnerCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_PARTNER_EMAIL;
  const password = process.env.E2E_PARTNER_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export async function irParaPersonalizar(page: Page): Promise<void> {
  await page.goto('/personalizar', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);
  await dismissChallengePopupIfPresent(page);
  await dismissAlertIfPresent(page);
  await expect(page.getByRole('heading', { name: /Meu Catálogo/i })).toBeVisible({
    timeout: 30_000,
  });
}

/** Primeiro momento mestre visível na seção Catálogo mestre. */
export async function obterPrimeiroMomentoMestre(page: Page): Promise<string> {
  const excluirBtn = page.getByRole('button', { name: 'Excluir do catálogo' }).first();
  await expect(excluirBtn, 'VIP deve ver momentos mestres com botão excluir').toBeVisible({
    timeout: 20_000,
  });
  const card = excluirBtn.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  const nome = (await card.locator('p.text-sm.font-semibold').first().textContent())?.trim() ?? '';
  expect(nome.length, 'Nome do momento mestre deve existir').toBeGreaterThan(0);
  return nome;
}

export async function excluirMomentoMestrePorNome(page: Page, nome: string): Promise<void> {
  const card = page
    .locator('div.rounded-2xl')
    .filter({ has: page.getByText(nome, { exact: true }) })
    .first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole('button', { name: 'Excluir do catálogo' }).click();
}

export async function salvarCatalogoMestre(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Salvar catálogo mestre/i }).click();
  await expect(page.getByText('Catálogo personalizado salvo!', { exact: true })).toBeVisible({
    timeout: 60_000,
  });
}

export async function aguardarMomentoMestreForaDoCatalogo(
  page: Page,
  nome: string,
): Promise<void> {
  const catalogoAtivo = page
    .locator('p:text("Catálogo mestre")')
    .locator('xpath=following::div[contains(@class,"space-y-3")][1]');
  await expect(catalogoAtivo.getByText(nome, { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
}

export async function expandirExcluidosSeNecessario(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /Excluídos \(\d+\)/i });
  if (await toggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await toggle.click();
  }
}

export async function criarMomentoCustom(
  page: Page,
  opts: { nome: string; preco?: number },
): Promise<void> {
  await page.getByRole('button', { name: /Criar momento/i }).click();
  const modal = page.getByRole('dialog', { name: 'Criar momento custom' });
  await expect(modal.getByRole('heading', { name: /Novo momento custom/i })).toBeVisible({
    timeout: 10_000,
  });

  await modal.getByPlaceholder('Ex: Noite especial').fill(opts.nome);

  if (opts.preco !== undefined) {
    await modal.locator('input[type="number"]').fill(String(opts.preco));
  }

  const fotoFixture = path.join(process.cwd(), 'app', 'icon.png');
  await modal.locator('input[type="file"]').setInputFiles(fotoFixture);
  await expect(modal.getByAltText('Preview')).toBeVisible({ timeout: 10_000 });

  await modal.getByRole('button', { name: /^Criar momento$/i }).click();

  await expect(page.getByText('Momento custom criado!', { exact: true })).toBeVisible({
    timeout: 90_000,
  });
}

export async function aguardarCustomNaPersonalizar(page: Page, nome: string): Promise<void> {
  const secao = page.locator('p:text("Meus momentos (custom)")').locator('..');
  await expect(secao.getByText(nome, { exact: true })).toBeVisible({ timeout: 60_000 });
}

export async function irParaLoja(page: Page): Promise<void> {
  await page.goto('/loja', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);
  await dismissChallengePopupIfPresent(page);
  await dismissAlertIfPresent(page);
  await expect(page.getByRole('heading', { name: /Catálogo de Momentos/i })).toBeVisible({
    timeout: 30_000,
  });
}

export async function verificarMomentoAusenteNaLoja(page: Page, nome: string): Promise<void> {
  await expect(page.getByRole('heading', { name: nome, level: 3 })).toHaveCount(0, {
    timeout: 10_000,
  });
}

export async function verificarCustomNaLoja(page: Page, nome: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Personalizado', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('heading', { name: nome, exact: true })).toBeVisible({
    timeout: 15_000,
  });
}
