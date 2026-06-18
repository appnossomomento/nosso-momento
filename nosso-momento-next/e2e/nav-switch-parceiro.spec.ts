import { test, expect } from '@playwright/test';
import {
  getUserACredentials,
  login,
  dismissAlertIfPresent,
  dismissPwaPromptIfPresent,
  dismissChallengePopupIfPresent,
} from './helpers/auth';

async function clickBottomNavHeart(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.bottom-nav-item-center').click();
}

test.describe.serial('Nav — switch de parceiro ativo', () => {
  test('bottom nav coração abre /parceiro (não /parear)', async ({ page }) => {
    const { email, password } = getUserACredentials();
    await login(page, email, password);
    await dismissPwaPromptIfPresent(page);
    await dismissChallengePopupIfPresent(page);

    await page.goto('/parear', { waitUntil: 'domcontentloaded' });
    await dismissPwaPromptIfPresent(page);
    await expect(page).toHaveURL(/\/parear/);

    await clickBottomNavHeart(page);
    await page.waitForURL(/\/parceiro/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/parear/);
  });

  test('chevron do header abre Pareamentos', async ({ page }) => {
    const { email, password } = getUserACredentials();
    await login(page, email, password);
    await dismissPwaPromptIfPresent(page);
    await dismissChallengePopupIfPresent(page);

    await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
    await dismissAlertIfPresent(page);

    const emptyState = page.getByRole('link', { name: /Ir para Pareamentos/i });
    if (await emptyState.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await emptyState.click();
      await expect(page).toHaveURL(/\/parear/);
      return;
    }

    const escolherConexao = page.getByRole('button', { name: /Escolher conexão/i });
    await expect(escolherConexao).toBeVisible({ timeout: 15_000 });
    await escolherConexao.click();
    await expect(page).toHaveURL(/\/parear/, { timeout: 15_000 });
  });

  test('reload em /parceiro mantém contexto do parceiro ativo', async ({ page }) => {
    const { email, password } = getUserACredentials();
    await login(page, email, password);
    await dismissPwaPromptIfPresent(page);
    await dismissChallengePopupIfPresent(page);

    await page.goto('/parceiro', { waitUntil: 'domcontentloaded' });
    await dismissAlertIfPresent(page);

    const emptyState = page.getByText(/Nenhuma conexão ativa/i);
    if (await emptyState.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'Usuário A sem conexão — pulando teste de persistência');
      return;
    }

    const escolherConexao = page.getByRole('button', { name: /Escolher conexão/i });
    await expect(escolherConexao).toBeVisible({ timeout: 15_000 });
    const nomeAntes = (await escolherConexao.locator('p').first().textContent())?.trim() ?? '';
    expect(nomeAntes.length).toBeGreaterThan(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissPwaPromptIfPresent(page);
    await dismissChallengePopupIfPresent(page);

    const escolherDepois = page.getByRole('button', { name: /Escolher conexão/i });
    await expect(escolherDepois).toBeVisible({ timeout: 30_000 });
    const nomeDepois = (await escolherDepois.locator('p').first().textContent())?.trim() ?? '';
    expect(nomeDepois).toBe(nomeAntes);
  });
});
