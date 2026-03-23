import { describe, it, expect } from 'vitest'
import {
  formatarCNPJ,
  formatarCPF,
  formatarMoeda,
  formatarData,
  formatarTelefone,
  formatarCEP,
} from './formatadores.js'
import {
  aplicarMascaraCNPJ,
  aplicarMascaraCPF,
  aplicarMascaraCEP,
  aplicarMascaraTelefone,
  removerMascara,
} from './mascaras.js'
import { validarEmail, validarCPF, validarCNPJ, validarCEP, validarTelefone } from './validadores.js'

// ─── Formatadores ───────────────────────────────────────────────────────────

describe('formatarCNPJ', () => {
  it('formata CNPJ sem pontuação', () => {
    expect(formatarCNPJ('12345678000195')).toBe('12.345.678/0001-95')
  })
  it('formata CNPJ com pontuação parcial', () => {
    expect(formatarCNPJ('12.345.678/0001-95')).toBe('12.345.678/0001-95')
  })
  it('trata string vazia', () => {
    expect(formatarCNPJ('')).toBe('')
  })
})

describe('formatarCPF', () => {
  it('formata CPF sem pontuação', () => {
    expect(formatarCPF('12345678901')).toBe('123.456.789-01')
  })
  it('formata CPF com pontuação parcial', () => {
    expect(formatarCPF('123.456.789-01')).toBe('123.456.789-01')
  })
  it('trata string vazia', () => {
    expect(formatarCPF('')).toBe('')
  })
})

describe('formatarMoeda', () => {
  it('formata valor positivo em BRL', () => {
    expect(formatarMoeda(1500.5)).toBe('R$\u00a01.500,50')
  })
  it('formata zero', () => {
    expect(formatarMoeda(0)).toBe('R$\u00a00,00')
  })
  it('formata valor negativo', () => {
    const resultado = formatarMoeda(-100)
    expect(resultado).toContain('100')
  })
  it('respeita casas decimais customizadas', () => {
    expect(formatarMoeda(10, 0)).toBe('R$\u00a010')
  })
})

describe('formatarData', () => {
  it('formata Date para dd/MM/yyyy', () => {
    const data = new Date(2026, 2, 22) // 22/03/2026
    expect(formatarData(data)).toBe('22/03/2026')
  })
  it('formata string ISO', () => {
    expect(formatarData('2026-03-22T00:00:00.000Z')).toMatch(/22/)
  })
  it('formata com formato customizado', () => {
    const data = new Date(2026, 2, 22)
    expect(formatarData(data, 'yyyy/MM/dd')).toBe('2026/03/22')
  })
  it('retorna string original para data inválida', () => {
    expect(formatarData('não-é-data')).toBe('não-é-data')
  })
})

describe('formatarTelefone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(formatarTelefone('11999998888')).toBe('(11) 99999-8888')
  })
  it('formata fixo com 10 dígitos', () => {
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
  })
  it('ignora caracteres não numéricos', () => {
    expect(formatarTelefone('(11) 99999-8888')).toBe('(11) 99999-8888')
  })
})

describe('formatarCEP', () => {
  it('formata CEP sem hífen', () => {
    expect(formatarCEP('01310100')).toBe('01310-100')
  })
  it('formata CEP com hífen', () => {
    expect(formatarCEP('01310-100')).toBe('01310-100')
  })
})

// ─── Máscaras ──────────────────────────────────────────────────────────────

describe('removerMascara', () => {
  it('remove todos os não-dígitos', () => {
    expect(removerMascara('12.345.678/0001-95')).toBe('12345678000195')
    expect(removerMascara('(11) 99999-8888')).toBe('11999998888')
  })
})

describe('aplicarMascaraCNPJ', () => {
  it('aplica máscara de CNPJ', () => {
    expect(aplicarMascaraCNPJ('12345678000195')).toBe('12.345.678/0001-95')
  })
})

describe('aplicarMascaraCPF', () => {
  it('aplica máscara de CPF', () => {
    expect(aplicarMascaraCPF('12345678901')).toBe('123.456.789-01')
  })
})

describe('aplicarMascaraCEP', () => {
  it('aplica máscara de CEP', () => {
    expect(aplicarMascaraCEP('01310100')).toBe('01310-100')
  })
})

describe('aplicarMascaraTelefone', () => {
  it('aplica máscara de celular', () => {
    expect(aplicarMascaraTelefone('11999998888')).toBe('(11) 99999-8888')
  })
  it('aplica máscara de fixo', () => {
    expect(aplicarMascaraTelefone('1133334444')).toBe('(11) 3333-4444')
  })
})

// ─── Validadores ─────────────────────────────────────────────────────────

describe('validarEmail', () => {
  it('aceita email válido', () => {
    expect(validarEmail('daniel@gravity.com')).toBe(true)
    expect(validarEmail('user.name+tag@domain.co')).toBe(true)
  })
  it('rejeita email sem @', () => {
    expect(validarEmail('invalido')).toBe(false)
  })
  it('rejeita email sem domínio', () => {
    expect(validarEmail('user@')).toBe(false)
  })
  it('rejeita string vazia', () => {
    expect(validarEmail('')).toBe(false)
  })
})

describe('validarCPF', () => {
  it('aceita CPF válido', () => {
    // CPF válido gerado para testes
    expect(validarCPF('529.982.247-25')).toBe(true)
  })
  it('rejeita CPF com todos dígitos iguais', () => {
    expect(validarCPF('111.111.111-11')).toBe(false)
    expect(validarCPF('00000000000')).toBe(false)
  })
  it('rejeita CPF com tamanho errado', () => {
    expect(validarCPF('123')).toBe(false)
  })
  it('rejeita CPF com dígito verificador errado', () => {
    expect(validarCPF('529.982.247-26')).toBe(false)
  })
})

describe('validarCNPJ', () => {
  it('aceita CNPJ válido', () => {
    expect(validarCNPJ('11.222.333/0001-81')).toBe(true)
  })
  it('rejeita CNPJ com todos dígitos iguais', () => {
    expect(validarCNPJ('11.111.111/1111-11')).toBe(false)
  })
  it('rejeita CNPJ com tamanho errado', () => {
    expect(validarCNPJ('123')).toBe(false)
  })
  it('rejeita CNPJ com dígito verificador errado', () => {
    expect(validarCNPJ('11.222.333/0001-82')).toBe(false)
  })
})

describe('validarCEP', () => {
  it('aceita CEP válido', () => {
    expect(validarCEP('01310-100')).toBe(true)
    expect(validarCEP('01310100')).toBe(true)
  })
  it('rejeita CEP com tamanho errado', () => {
    expect(validarCEP('123')).toBe(false)
  })
  it('rejeita CEP com todos dígitos iguais', () => {
    expect(validarCEP('00000000')).toBe(false)
  })
})

describe('validarTelefone', () => {
  it('aceita celular', () => {
    expect(validarTelefone('11999998888')).toBe(true)
  })
  it('aceita fixo', () => {
    expect(validarTelefone('1133334444')).toBe(true)
  })
  it('rejeita tamanho inválido', () => {
    expect(validarTelefone('123')).toBe(false)
  })
})
