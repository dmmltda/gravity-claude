import { prisma } from '../prisma/client.js'

export type PermissionMap = Record<string, boolean | string | string[] | number>

export async function getUserPermissions(
  clerkId: string,
  tenantId: string,
  companyId: string,
  productId: string
): Promise<{ role: string | null; permissions: PermissionMap }> {
  const membership = await prisma.userMembership.findUnique({
    where: { clerkId_tenantId: { clerkId, tenantId } },
  })

  if (!membership) {
    return { role: null, permissions: {} }
  }

  const enablement = await prisma.userEnablement.findUnique({
    where: {
      membershipId_companyId: {
        membershipId: membership.id,
        companyId,
      },
    },
    include: {
      permissions: { where: { productId } },
    },
  })

  if (!enablement) {
    return { role: membership.role, permissions: {} }
  }

  const productPermission = enablement.permissions[0]
  const permissions = productPermission
    ? (productPermission.permissions as PermissionMap)
    : {}

  return { role: membership.role, permissions }
}

export async function setProductPermissions(
  enablementId: string,
  productId: string,
  permissions: PermissionMap
) {
  return prisma.productPermission.upsert({
    where: { enablementId_productId: { enablementId, productId } },
    create: { enablementId, productId, permissions },
    update: { permissions },
  })
}
