export function validarEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  return re.test(email.trim())
}

export function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11) return false
  if (/^(\d)\1{10}$/.test(nums)) return false

  const calcDigito = (base: string, pesos: number[]): number => {
    const soma = base
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const d1 = calcDigito(nums.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  if (d1 !== Number(nums[9])) return false

  const d2 = calcDigito(nums.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return d2 === Number(nums[10])
}

export function validarCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '')
  if (nums.length !== 14) return false
  if (/^(\d)\1{13}$/.test(nums)) return false

  const calcDigito = (base: string, pesos: number[]): number => {
    const soma = base
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const d1 = calcDigito(nums.slice(0, 12), pesos1)
  if (d1 !== Number(nums[12])) return false

  const d2 = calcDigito(nums.slice(0, 13), pesos2)
  return d2 === Number(nums[13])
}

export function validarCEP(cep: string): boolean {
  const nums = cep.replace(/\D/g, '')
  return nums.length === 8 && !/^(\d)\1{7}$/.test(nums)
}

export function validarTelefone(telefone: string): boolean {
  const nums = telefone.replace(/\D/g, '')
  return nums.length === 10 || nums.length === 11
}
