import { PrismaClient } from '@prisma/client'

// Instância global do PrismaClient para o serviço de notificações.
// Reutiliza conexão entre chamadas em ambiente serverless/Railway.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
