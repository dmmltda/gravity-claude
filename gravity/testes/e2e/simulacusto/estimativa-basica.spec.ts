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

  // 4. Preenche aba Dados
  await page.fill('[data-testid="input-descricao"]', 'Teste E2E')

  // 5. Muda para aba Produto
  await page.click('text=2. Produto')
  await page.fill('[data-testid="input-ncm"]', '84833000')

  // Aguarda PTAX ser preenchido automaticamente
  await page.waitForTimeout(800)

  // Preenche valor do produto (necessário para habilitar botão calcular)
  await page.fill('input[type="number"]', '1000')

  // 6. Calcula
  await page.click('[data-testid="btn-calcular"]')

  // 7. Verifica resultado na página de detalhe
  await page.waitForURL('**/estimativas/**')
  await expect(page.locator('[data-testid="landed-cost"]')).toBeVisible()

  // 8. Verifica status
  await expect(page.locator('text=criada')).toBeVisible()
})
