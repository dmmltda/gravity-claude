interface ConfiguradorParams {
  produto?: string
  plano?: string
  trial?: boolean
}

export function buildConfiguradorUrl(params: ConfiguradorParams): string {
  const base = import.meta.env.VITE_CONFIGURADOR_URL as string
  const query = new URLSearchParams()
  if (params.produto) query.set('produto', params.produto)
  if (params.plano) query.set('plano', params.plano)
  if (params.trial) query.set('trial', 'true')
  return `${base}/checkout?${query.toString()}`
}

export function buildTrialUrl(produto: string): string {
  const base = import.meta.env.VITE_CONFIGURADOR_URL as string
  return `${base}/trial?produto=${produto}&trial=true`
}
