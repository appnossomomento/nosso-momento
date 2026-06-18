import { expect, type Page } from '@playwright/test';
import {
  dismissAlertIfPresent,
  dismissChallengePopupIfPresent,
  dismissPwaPromptIfPresent,
} from './auth';

/** Resgata o primeiro momento disponível na loja (com foguinhos). */
export async function resgatarMomentoNaLoja(page: Page): Promise<string> {
  await page.goto('/loja', { waitUntil: 'domcontentloaded' });
  await dismissPwaPromptIfPresent(page);
  await dismissChallengePopupIfPresent(page);
  await dismissAlertIfPresent(page);

  const resgatar = page.getByRole('button', { name: /^Resgatar$/i }).first();
  await expect(resgatar, 'Deve existir ao menos um momento resgatável na loja').toBeVisible({
    timeout: 20_000,
  });
  await expect(resgatar, 'Botão Resgatar deve estar habilitado (foguinhos suficientes)').toBeEnabled({
    timeout: 5_000,
  });

  const card = resgatar.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")]').first();
  const nomeMomento =
    (await card.locator('h3').first().textContent().catch(() => null))?.trim() ?? 'momento';

  await resgatar.click();
  await expect(page.getByText('Meu carrinho')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Finalizar Pedido/i }).click();

  const confirmar = page.getByRole('button', { name: /^Confirmar$/i });
  await expect(confirmar).toBeVisible({ timeout: 10_000 });
  await confirmar.click();

  await expect(page.getByText(/Momentos resgatados/i)).toBeVisible({ timeout: 20_000 });

  return nomeMomento;
}

/** Aguarda momento pendente na aba Enviados (processInput assíncrono). */
export async function aguardarMomentoPendenteEnviados(page: Page, timeoutMs = 90_000): Promise<void> {
  await page.goto('/momentos', { waitUntil: 'domcontentloaded' });
  await dismissChallengePopupIfPresent(page);
  await dismissAlertIfPresent(page);

  const enviados = page.getByRole('button', { name: /^enviados$/i });
  await enviados.click();

  const feitoBtn = page.getByRole('button', { name: /Feito/i }).first();
  await expect(feitoBtn, 'Momento resgatado deve aparecer na aba Enviados').toBeVisible({
    timeout: timeoutMs,
  });
  await expect(page.getByText('Pendente').first()).toBeVisible({ timeout: 10_000 });
}

/** Marca o primeiro momento enviado como realizado (sem foto). */
export async function realizarMomentoEnviado(page: Page): Promise<void> {
  await page.goto('/momentos', { waitUntil: 'domcontentloaded' });
  await dismissChallengePopupIfPresent(page);

  const enviados = page.getByRole('button', { name: /^enviados$/i });
  await enviados.click();

  const feitoBtn = page.getByRole('button', { name: /Feito/i }).first();
  await expect(feitoBtn).toBeVisible({ timeout: 15_000 });
  await feitoBtn.click();

  await expect(page.getByText('Momento Realizado!')).toBeVisible({ timeout: 10_000 });

  const confirmarSemFoto = page.getByRole('button', { name: /Confirmar sem Foto/i });
  await expect(confirmarSemFoto).toBeVisible({ timeout: 10_000 });
  await confirmarSemFoto.click();

  await expect(page.getByText(/realizado/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Realizado').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Feito/i })).toHaveCount(0, { timeout: 10_000 });
}
