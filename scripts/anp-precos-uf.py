#!/usr/bin/env python3
"""Gera shared/dados/combustivel-uf.ts com o preco medio de revenda por UF
(Levantamento de Precos da ANP, planilha "resumo semanal", aba ESTADOS).

Uso: python3 -I scripts/anp-precos-uf.py <resumo_semanal_lpc_....xlsx> > shared/dados/combustivel-uf.ts
Planilhas: https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas
"""
import sys, unicodedata, openpyxl

UF = {'ACRE':'AC','ALAGOAS':'AL','AMAPA':'AP','AMAZONAS':'AM','BAHIA':'BA','CEARA':'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES','GOIAS':'GO','MARANHAO':'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS','MINAS GERAIS':'MG','PARA':'PA','PARAIBA':'PB','PARANA':'PR','PERNAMBUCO':'PE','PIAUI':'PI','RIO DE JANEIRO':'RJ','RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS','RONDONIA':'RO','RORAIMA':'RR','SANTA CATARINA':'SC','SAO PAULO':'SP','SERGIPE':'SE','TOCANTINS':'TO'}
PROD = {'GASOLINA COMUM':'gasolina','ETANOL HIDRATADO':'etanol','OLEO DIESEL S10':'diesel'}
sem = lambda s: unicodedata.normalize('NFD', str(s or '')).encode('ascii','ignore').decode().upper().strip()

ws = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)['ESTADOS']
precos, ini, fim = {}, None, None
for r in ws.iter_rows(min_row=11, values_only=True):
    if not r or not r[3]: continue
    uf, prod = UF.get(sem(r[3])), PROD.get(sem(r[4]))
    if not uf or not prod or not isinstance(r[7], (int, float)): continue
    precos.setdefault(uf, {})[prod] = round(float(r[7]), 2)
    ini, fim = r[0], r[1]
assert len(precos) == 27, len(precos)
print('// GERADO por scripts/anp-precos-uf.py: nao editar a mao.')
print(f'// ANP, Levantamento de Precos de Combustiveis, preco medio de revenda por UF, semana {ini:%d/%m/%Y} a {fim:%d/%m/%Y}.')
print('// Diesel = oleo diesel S10. Reais por litro.')
print(f"export const SEMANA_ANP = '{ini:%d/%m/%Y} a {fim:%d/%m/%Y}'")
print('export const PRECO_COMBUSTIVEL_UF: Record<string, { gasolina?: number; etanol?: number; diesel?: number }> = {')
for uf in sorted(precos):
    print(f"  {uf}: {{ {', '.join(f'{k}: {v}' for k, v in sorted(precos[uf].items()))} }},")
print('}')
