import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['testes/testes-unitarios/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['servicos-global/**/*.ts', 'produtos/**/*.ts', 'nucleo-global/**/*.ts'],
      exclude: ['**/*.test.ts', '**/node_modules/**', '**/prisma/**'],
    },
  },
})
