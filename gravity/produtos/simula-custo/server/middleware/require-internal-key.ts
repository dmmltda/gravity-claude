import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'

export function requireInternalKey(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (process.env['NODE_ENV'] === 'development') return next()

  const key = req.headers['x-internal-key']
  if (key !== process.env['INTERNAL_SERVICE_KEY']) {
    return next(new AppError(403, 'FORBIDDEN', 'Acesso negado'))
  }
  next()
}
