import { describe, it, expect } from 'vitest'
import { linhaRecallGrade } from './recall-grade'

const nissan = (status: string[]) => ({ fonte: 'nissan', consultado: true, campanhas: status.map((s, i) => ({ codigo: `C${i}`, status: s })) })

describe('linhaRecallGrade (SENATRAN x montadora)', () => {
  it('DIVERGEM: mostra as duas fontes', () => {
    expect(linhaRecallGrade(true, nissan(['realizado', 'realizado']))).toEqual({ texto: 'PENDENTE no SENATRAN, REALIZADO segundo a Nissan', alerta: false })
    expect(linhaRecallGrade(false, { ...nissan(['aberto']), fonte: 'mitsubishi' })).toEqual({ texto: 'EM DIA no SENATRAN, EM ABERTO segundo a Mitsubishi', alerta: true })
    expect(linhaRecallGrade(true, { ...nissan(['realizado']), fonte: 'mercedes-benz' })!.texto).toBe('PENDENTE no SENATRAN, REALIZADO segundo a Mercedes-Benz')
  })
  it('CONCORDAM (ou sem consulta da montadora): linha normal (null)', () => {
    expect(linhaRecallGrade(true, nissan(['aberto', 'realizado']))).toBeNull()
    expect(linhaRecallGrade(false, nissan(['realizado']))).toBeNull()
    expect(linhaRecallGrade(true, null)).toBeNull()
    expect(linhaRecallGrade(true, nissan([]))).toBeNull()
  })
})
