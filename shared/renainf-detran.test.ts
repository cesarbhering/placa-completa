import { describe, it, expect } from 'vitest'
import { ufRenainfForaDoDetran, textoMultasRenainfForaDoDetran, EXPLICA_RENAINF_FORA_DO_DETRAN } from './renainf-detran'

const sp0 = { status: 'ok', fonte: 'detran_sp', multas_total_centavos: 0 }

describe('RENAINF aceso com DETRAN da UF zerado', () => {
  it('caso FUG0A96: RENAINF true + DETRAN-SP ok com 0', () => {
    expect(ufRenainfForaDoDetran(true, sp0, 'SP')).toBe('SP')
  })
  it('UF pela fonte, pelo campo uf ou pela UF do veiculo', () => {
    expect(ufRenainfForaDoDetran(true, { status: 'ok', fonte: 'detran_mg', multas_total_centavos: 0 }, 'SP')).toBe('MG')
    expect(ufRenainfForaDoDetran(true, { status: 'ok', uf: 'sc', multas_total_centavos: 0 })).toBe('SC')
    expect(ufRenainfForaDoDetran(true, { status: 'ok', fonte: 'govbr', multas_total_centavos: 0 }, 'pr')).toBe('PR')
  })
  it('nada muda nos outros casos', () => {
    expect(ufRenainfForaDoDetran(false, sp0, 'SP')).toBeNull()
    expect(ufRenainfForaDoDetran(null, sp0, 'SP')).toBeNull()
    expect(ufRenainfForaDoDetran(true, { ...sp0, multas_total_centavos: 19523 }, 'SP')).toBeNull()
    expect(ufRenainfForaDoDetran(true, null, 'SP')).toBeNull()
    expect(ufRenainfForaDoDetran(true, { status: 'indisponivel', fonte: 'detran_sp' }, 'SP')).toBeNull()
    expect(ufRenainfForaDoDetran(true, { status: 'consultando', fonte: 'detran_sp' }, 'SP')).toBeNull()
    expect(ufRenainfForaDoDetran(true, { status: 'ok', fonte: 'detran_sp', multas_total_centavos: null }, 'SP')).toBeNull()
  })
  it('textos aprovados, literais, sem travessao', () => {
    expect(textoMultasRenainfForaDoDetran('SP')).toBe('No DETRAN-SP: nada consta. O indicador nacional (RENAINF) aponta multa em aberto aplicada por órgão de outro estado ou federal (como a PRF), que não aparece no DETRAN de origem. Confirme com o vendedor antes de fechar negócio.')
    expect(EXPLICA_RENAINF_FORA_DO_DETRAN).toBe('Consta multa em aberto registrada no sistema nacional (RENAINF), aplicada fora do estado de registro ou por órgão federal.')
    expect(textoMultasRenainfForaDoDetran('SP') + EXPLICA_RENAINF_FORA_DO_DETRAN).not.toContain('—')
  })
})
