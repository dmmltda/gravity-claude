export function formatarCNPJ(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 14)
  return nums
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatarCPF(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11)
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function formatarMoeda(valor: number, casasDecimais = 2): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  })
}

export function formatarData(data: Date | string | number, formato = 'dd/MM/yyyy'): string {
  const d = data instanceof Date ? data : new Date(data)
  if (isNaN(d.getTime())) return String(data)

  const partes: Record<string, string> = {
    dd: String(d.getDate()).padStart(2, '0'),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    yyyy: String(d.getFullYear()),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0'),
  }

  return formato.replace(/dd|MM|yyyy|HH|mm|ss/g, (token) => partes[token] ?? token)
}

export function formatarTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11)
  if (nums.length === 11) {
    return nums.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (nums.length === 10) {
    return nums.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return nums
}

export function formatarCEP(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 8)
  return nums.replace(/(\d{5})(\d{1,3})/, '$1-$2')
}

export function formatarNumero(valor: number, casasDecimais = 2): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  })
}
