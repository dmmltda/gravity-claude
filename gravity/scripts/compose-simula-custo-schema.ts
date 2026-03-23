import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const BASE_PATH = path.join(ROOT, 'produtos/simula-custo/server/prisma/schema.base.prisma')
const OUTPUT_PATH = path.join(ROOT, 'produtos/simula-custo/server/prisma/schema.prisma')
const HELPDESK_FRAGMENT = path.join(
  ROOT,
  'servicos-global/produto/helpdesk/prisma/fragment.prisma'
)

const base = fs.readFileSync(BASE_PATH, 'utf8')

const included: string[] = []
const skipped: string[] = []

const fragments: string[] = []

if (fs.existsSync(HELPDESK_FRAGMENT)) {
  fragments.push(fs.readFileSync(HELPDESK_FRAGMENT, 'utf8'))
  included.push('helpdesk')
} else {
  console.warn(`[compose-simula-custo-schema] Fragment não encontrado (pulando): ${HELPDESK_FRAGMENT}`)
  skipped.push('helpdesk')
}

const header = `// ARQUIVO GERADO — não editar manualmente.\n// Execute scripts/compose-simula-custo-schema.ts para regenerar.\n`

const composed = [header, base, ...fragments].join('\n\n')

fs.writeFileSync(OUTPUT_PATH, composed, 'utf8')

console.log(`[compose-simula-custo-schema] Schema composto com sucesso.`)
if (included.length > 0) {
  console.log(`[compose-simula-custo-schema] Fragments incluídos: ${included.join(', ')}`)
}
if (skipped.length > 0) {
  console.warn(`[compose-simula-custo-schema] Fragments ausentes (ignorados): ${skipped.join(', ')}`)
}
