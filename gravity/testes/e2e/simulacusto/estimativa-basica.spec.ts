import { test, expect } from '@playwright/test'

test('estimativa básica — fluxo completo', async ({ page }) => {
  // 1. Login
  await page.goto('/login')
  await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? '')
  await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? '')
  await page.click('[type="submit"]')

  // 2. Navega para estimativas
  await page.waitForURL('**/dashboard**')
  await page.goto('/simulacusto/estimativas')

  // 3. Nova estimativa
  await page.click('text=Nova Estimativa')

  // 4. Preenche formulário
  await page.fill('[name="ncm"]', '84833000')
  await page.fill('[name="descricao"]', 'Teste E2E')
  await page.fill('[name="quantidade"]', '100')

  // 5. Calcula
  await page.click('text=Calcular')

  // 6. Verifica resultado
  await expect(page.locator('[data-testid="landed-cost"]')).toBeVisible()

  // 7. Verifica status
  await expect(page.locator('text=criada')).toBeVisible()
})
