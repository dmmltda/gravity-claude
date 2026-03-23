import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const TENANT_DIR = path.join(ROOT, 'servicos-global/tenant')
const BASE_PATH = path.join(TENANT_DIR, 'prisma/schema.base.prisma')
const OUTPUT_PATH = path.join(TENANT_DIR, 'prisma/schema.prisma')

const SERVICES = [
  'atividades',
  'cronometro',
  'email',
  'whatsapp',
  'dashboard',
  'relatorios',
  'historico',
  'agendamento',
  'gabi',
  'notificacoes',
  'api-cockpit',
  'conector-erp',
]

const base = fs.readFileSync(BASE_PATH, 'utf8')

const included: string[] = []
const skipped: string[] = []

const fragmentContents = SERVICES.map((service) => {
  const fragmentPath = path.join(
    TENANT_DIR,
    service,
    'prisma/fragment.prisma'
  )

  if (!fs.existsSync(fragmentPath)) {
    console.warn(`[compose-tenant-schema] Fragment não encontrado (pulando): ${fragmentPath}`)
    skipped.push(service)
    return null
  }

  included.push(service)
  return fs.readFileSync(fragmentPath, 'utf8')
}).filter((content): content is string => content !== null)

const header = `// ARQUIVO GERADO — não editar manualmente.\n// Execute scripts/compose-tenant-schema.ts para regenerar.\n`

const composed = [header, base, ...fragmentContents].join('\n\n')

fs.writeFileSync(OUTPUT_PATH, composed, 'utf8')

console.log(`[compose-tenant-schema] Schema composto com sucesso.`)
if (included.length > 0) {
  console.log(`[compose-tenant-schema] Fragments incluídos: ${included.join(', ')}`)
}
if (skipped.length > 0) {
  console.warn(`[compose-tenant-schema] Fragments ausentes (ignorados): ${skipped.join(', ')}`)
}
