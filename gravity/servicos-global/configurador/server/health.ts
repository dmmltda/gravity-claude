import type { Request, Response } from 'express'
import { prisma } from './prisma/client.js'

// GET /health — sem autenticação
export async function healthHandler(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      service: 'configurador',
      timestamp: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({
      status: 'down',
      service: 'configurador',
      timestamp: new Date().toISOString(),
    })
  }
}
