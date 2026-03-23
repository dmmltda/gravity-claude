import type { MascaraConfig } from './types.js'

export const MASCARAS = {
  telefone: { mascara: '(##) #####-####', placeholder: '(00) 00000-0000' },
  telefoneFixo: { mascara: '(##) ####-####', placeholder: '(00) 0000-0000' },
  cep: { mascara: '#####-###', placeholder: '00000-000' },
  cnpj: { mascara: '##.###.###/####-##', placeholder: '00.000.000/0000-00' },
  cpf: { mascara: '###.###.###-##', placeholder: '000.000.000-00' },
  data: { mascara: '##/##/####', placeholder: 'dd/mm/aaaa' },
} as const satisfies Record<string, MascaraConfig>

export function aplicarMascara(valor: string, mascara: string): string {
  const nums = valor.replace(/\D/g, '')
  let resultado = ''
  let posicaoNum = 0

  for (let i = 0; i < mascara.length && posicaoNum < nums.length; i++) {
    if (mascara[i] === '#') {
      resultado += nums[posicaoNum]
      posicaoNum++
    } else {
      resultado += mascara[i]
    }
  }

  return resultado
}

export function removerMascara(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function aplicarMascaraTelefone(valor: string): string {
  const nums = removerMascara(valor)
  if (nums.length <= 10) {
    return aplicarMascara(nums, MASCARAS.telefoneFixo.mascara)
  }
  return aplicarMascara(nums, MASCARAS.telefone.mascara)
}

export function aplicarMascaraCNPJ(valor: string): string {
  return aplicarMascara(valor, MASCARAS.cnpj.mascara)
}

export function aplicarMascaraCPF(valor: string): string {
  return aplicarMascara(valor, MASCARAS.cpf.mascara)
}

export function aplicarMascaraCEP(valor: string): string {
  return aplicarMascara(valor, MASCARAS.cep.mascara)
}

export function aplicarMascaraData(valor: string): string {
  return aplicarMascara(valor, MASCARAS.data.mascara)
}
