import type { Request } from 'express'

export interface TenantRequest extends Request {
  tenantId: string
  userId: string
  isServiceToken: boolean
}
