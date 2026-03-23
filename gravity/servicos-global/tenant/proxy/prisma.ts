import { PrismaClient } from '@prisma/client'

// Instância global do PrismaClient para o módulo proxy
// Reutiliza conexão entre chamadas em ambiente serverless/Railway
const globalForPrisma = globalThis as unknown as { prismaProxy?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prismaProxy ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaProxy = prisma
}
