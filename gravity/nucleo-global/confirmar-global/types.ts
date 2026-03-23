export interface ConfirmarConfig {
  titulo?: string
  mensagem: string
  textoBotaoConfirmar?: string
  textoBotaoCancelar?: string
  variante?: 'padrao' | 'perigo'
}

export interface ConfirmarState {
  visivel: boolean
  config: ConfirmarConfig
  resolver: ((valor: boolean) => void) | null
}
