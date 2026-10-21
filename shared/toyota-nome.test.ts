import { describe, it, expect } from 'vitest'
import { fatosToyota } from './toyota-nome'
import { cambioDoNome } from './cambio-nome'
import { versaoDoNome, filtrarPelaVersaoDoNome, faltaVersaoDoNome } from './versao-fipe'

describe('fatosToyota (token colado do cadastro)', () => {
  it('CDSRXA4FD = cabine dupla, SRX, automatico, 4x4 diesel', () => {
    expect(fatosToyota('I/TOYOTA HILUX CDSRXA4FD')).toEqual({ cabine: 'dupla', sw4: false, versao: 'SRX', cambio: 'automatico', tracao: '4X4', combustivel: 'diesel', lugares: null })
  })
  it('SWSRXA4FD = SW4 SRX; CSSTDM2FA = cabine simples STD manual 4x2 flex; SRV 7L', () => {
    expect(fatosToyota('I/TOYOTA HILUX SWSRXA4FD')).toMatchObject({ sw4: true, versao: 'SRX', cambio: 'automatico' })
    expect(fatosToyota('TOYOTA/HILUX CSSTDM2FA')).toMatchObject({ cabine: 'simples', versao: 'STD', cambio: 'manual', tracao: '4X2', combustivel: 'flex' })
    expect(fatosToyota('TOYOTA/HILUX SW4 SRVA4FD7L')).toMatchObject({ sw4: true, versao: 'SRV', lugares: 7 })
    expect(fatosToyota('I/TOYOTA HILUX CD4X4 SRV')).toMatchObject({ cabine: 'dupla', versao: 'SRV', tracao: '4X4', cambio: null })
  })
  it('SR, SRV e SRX sao siglas diferentes', () => {
    expect(fatosToyota('TOYOTA/HILUX CDSRA4FD')?.versao).toBe('SR')
    expect(fatosToyota('TOYOTA/HILUX CDSRVA4FD')?.versao).toBe('SRV')
  })
  it('fora da Toyota ou sem token: null; letra solta nao e cambio', () => {
    expect(fatosToyota('CHEV/S10 LS DS4')).toBeNull()
    expect(fatosToyota('TOYOTA/COROLLA XEI18VVT')).toBeNull()
    expect(fatosToyota('TOYOTA/ETIOS HB X')).toBeNull()
    expect(fatosToyota('TOYOTA/ETIOS SD XLS15 AT')).toBeNull()
  })
  it('cambioDoNome le o A/M colado da Toyota', () => {
    expect(cambioDoNome('I/TOYOTA HILUX CDSRXA4FD')).toBe('automatico')
    expect(cambioDoNome('TOYOTA/HILUX CSSTDM2FA')).toBe('manual')
    expect(cambioDoNome('I/TOYOTA HILUX CD4X4 SRV')).toBeNull()
    expect(cambioDoNome('TOYOTA/ETIOS SD XLS15 AT')).toBe('automatico')
  })
})

describe('versao Toyota no filtro do nome', () => {
  const lista = [
    { modelo: 'Hilux CD 4x4 2.8 Diesel Mec.' },
    { modelo: 'Hilux CD SR 4x4 2.8 TDI Diesel Aut.' },
    { modelo: 'Hilux CD SRV 4x4 2.8 TDI Diesel Aut.' },
    { modelo: 'Hilux CD SRX 4x4 2.8 TDI 16V Diesel Aut.' },
    { modelo: 'Hilux Chassi 4x4 2.8 TDI Diesel Mec.' },
  ]
  it('versaoDoNome tira a sigla do token colado', () => {
    expect(versaoDoNome('I/TOYOTA HILUX CDSRXA4FD').versoes).toEqual(['SRX'])
  })
  it('SRX fica so com a SRX', () => {
    expect(filtrarPelaVersaoDoNome(lista, 'I/TOYOTA HILUX CDSRXA4FD').map((c) => c.modelo)).toEqual(['Hilux CD SRX 4x4 2.8 TDI 16V Diesel Aut.'])
  })
  it('CD sem versao: tira o Chassi', () => {
    expect(filtrarPelaVersaoDoNome(lista, 'TOYOTA/HILUX CD4X4').map((c) => c.modelo)).not.toContain('Hilux Chassi 4x4 2.8 TDI Diesel Mec.')
  })
  it('faltaVersaoDoNome: SRX sem SRX na lista', () => {
    expect(faltaVersaoDoNome(lista.filter((c) => !/SRX/.test(c.modelo)), 'I/TOYOTA HILUX CDSRXA4FD')).toBe(true)
    expect(faltaVersaoDoNome(lista, 'I/TOYOTA HILUX CDSRXA4FD')).toBe(false)
    expect(faltaVersaoDoNome(lista, 'TOYOTA/HILUX CD4X4')).toBe(false)
  })
  it('Corolla: XEI, GLI, XRS, Altis e GR-S pela sigla exata', () => {
    const corolla = [
      { modelo: 'Corolla XEi 2.0 Flex 16V Aut.' },
      { modelo: 'Corolla GLi 1.8 Flex 16V Aut.' },
      { modelo: 'Corolla XRS 2.0 Flex 16V Aut.' },
      { modelo: 'Corolla Altis 2.0 Flex 16V Aut.' },
      { modelo: 'Corolla GR-S 2.0 Flex 16V Aut.' },
    ]
    expect(filtrarPelaVersaoDoNome(corolla, 'TOYOTA/COROLLA XEI20FLEX').map((c) => c.modelo)).toEqual(['Corolla XEi 2.0 Flex 16V Aut.'])
    expect(filtrarPelaVersaoDoNome(corolla, 'TOYOTA/COROLLA XRS FLEX').map((c) => c.modelo)).toEqual(['Corolla XRS 2.0 Flex 16V Aut.'])
    expect(filtrarPelaVersaoDoNome(corolla, 'TOYOTA/COROLLA GR-S').map((c) => c.modelo)).toEqual(['Corolla GR-S 2.0 Flex 16V Aut.'])
    expect(filtrarPelaVersaoDoNome(corolla, 'TOYOTA/COROLLA ALTIS20').map((c) => c.modelo)).toEqual(['Corolla Altis 2.0 Flex 16V Aut.'])
  })
})
