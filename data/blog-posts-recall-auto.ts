import type { BlogPost } from './blog-posts'
import posts from './blog-posts-recall-auto.json'

// Posts de recall gerados por ops/recall-publicar/pc-recall-publicar, um PR
// por mes, sempre revisados antes do merge. O gerador so acrescenta no JSON
// (mais recente primeiro); edite o texto la mesmo na revisao.
export const postsRecallAuto = posts as BlogPost[]
