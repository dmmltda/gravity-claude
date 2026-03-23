import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
const BASE_PATH = path.join(ROOT, 'produtos/simula-custo/server/prisma/schema.base.prisma')
const OUTPUT_PATH = path.join(ROOT, 'produtos/simula-custo/server/prisma/schema.prisma')

// Fragments a incluir — primeiro o do próprio produto, depois serviços de produto
const FRAGMENT_PATHS: Array<{ name: string; path: string }> = [
  {
    name: 'simula-custo',
    path: path.join(ROOT, 'produtos/simula-custo/server/prisma/fragment.prisma'),
  },
  {
    name: 'helpdesk',
    path: path.join(ROOT, 'servicos-global/produto/helpdesk/prisma/fragment.prisma'),
  },
]

const base = fs.readFileSync(BASE_PATH, 'utf8')

const included: string[] = []
const skipped: string[] = []

const fragments: string[] = []

for (const { name, path: fragmentPath } of FRAGMENT_PATHS) {
  if (fs.existsSync(fragmentPath)) {
    fragments.push(fs.readFileSync(fragmentPath, 'utf8'))
    included.push(name)
  } else {
    console.warn(`[compose-simula-custo-schema] Fragment não encontrado (pulando): ${fragmentPath}`)
    skipped.push(name)
  }
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
