import { prisma } from '../prisma/client.js'

export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'past_due'

export async function getActiveSubscriptions(tenantId: string) {
  return prisma.subscription.findMany({
    where: { tenantId, status: 'active' },
  })
}

export async function hasActiveSubscription(
  tenantId: string,
  productId: string
): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      productId,
      status: { in: ['active', 'trial'] },
    },
  })
  return subscription !== null
}

export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus
) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status },
  })
}
