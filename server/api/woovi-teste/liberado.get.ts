import { testeWooviLiberado } from '../../utils/woovi-teste-guard'

// A pagina pergunta ao servidor se ela pode existir. A decisao nao pode morar
// no client: public.homolog e assado no bundle em build, e o provedor e env de
// runtime, entao so o servidor sabe a verdade dos dois.
export default defineEventHandler(() => ({ ok: testeWooviLiberado() }))
