export interface FormatOptions {
  prefixo?: string
  sufixo?: string
  casasDecimais?: number
}

export interface MascaraConfig {
  mascara: string
  placeholder?: string
}

export interface ValidadorResult {
  valido: boolean
  mensagem?: string
}
