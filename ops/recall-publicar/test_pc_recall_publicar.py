"""Regressao do gerador de posts de recall (so a parte de texto, sem banco/git).
Rodar: python3 -m unittest discover -s ops/recall-publicar
Casos reais da base em out/2026: Ranger com faixa 1997 a 2027 (campanha de um
modelo so) e Bronco Sport + Maverick (uma campanha, dois modelos)."""
import datetime as dt, importlib.machinery, importlib.util, json, os, unittest

_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pc-recall-publicar')
_ld = importlib.machinery.SourceFileLoader('pc_recall_publicar', _p)
_spec = importlib.util.spec_from_loader('pc_recall_publicar', _ld)
m = importlib.util.module_from_spec(_spec)
_ld.exec_module(m)

HOJE = dt.date(2026, 11, 2)
RANGER = {
    'id': 'ford_2026__ford-ranger-modelo-2027_ranger', 'marca': 'FORD', 'code': None,
    'name': 'FORD RANGER, MODELO 2027, EQUIPADO COM MOTOR 2.0L', 'model': 'Ranger', 'model_year': '1997 a 2027',
    'start_date': '2026-09-24', 'componente': None, 'defeito': None, 'o_que_fazer': None, 'tempo_reparo': None,
    'risco': 'o conjunto do tubo de saída do cilindro mestre do freio pode apresentar um vazamento de fluido de freio',
    'reparo': 'inspeção e, se necessário, substituição gratuita do conjunto do tubo de saída do cilindro mestre do freio.',
    'pdf_url': 'https://www.ford.com.br/servico-ao-cliente/recall/2026/ford-ranger-modelo-2027/',
}
BRONCO = {
    'id': 'ford_2026__ford-bronco-sport-2025-e-ford-maverick-2025_bronco-sport', 'marca': 'FORD', 'code': None,
    'name': 'FORD BRONCO SPORT MODELO 2025 E FORD MAVERICK MODELOS 2025', 'model': 'Bronco Sport', 'model_year': '2025',
    'start_date': '2026-09-03', 'componente': None, 'defeito': None, 'o_que_fazer': None, 'tempo_reparo': None,
    'risco': 'a válvula de recirculação de gases do escape do motor (EGR) pode não funcionar corretamente',
    'reparo': 'substituição gratuita da válvula de recirculação de gases do escape (EGR).',
    'pdf_url': 'https://www.ford.com.br/servico-ao-cliente/recall/2026/ford-bronco-sport-2025-e-ford-maverick-2025/',
}
MAVERICK = {**BRONCO, 'id': BRONCO['id'].replace('_bronco-sport', '_maverick'), 'model': 'Maverick'}
LAND_ROVER = {
    'id': 'procon_landrover_2326', 'marca': 'LAND ROVER', 'code': '2326', 'name': 'Defender, Range Rover Sport, Discovery: Sistema do motor',
    'model': 'Defender / Range Rover Sport / Discovery', 'model_year': '2024 a 2026', 'start_date': '2026-07-24',
    'componente': 'Sistema do motor', 'defeito': 'Polia intermediária', 'risco': 'Pode causar vazamento de óleo do motor.',
    'o_que_fazer': 'Entrar em contato com um concessionário autorizado', 'reparo': 'x', 'tempo_reparo': 'O tempo estimado para o reparo é de até 50 minutos.',
    'pdf_url': 'https://sistemas.procon.sp.gov.br/recall/',
}


def texto(post):
    return json.dumps(post, ensure_ascii=False)


class Gerador(unittest.TestCase):
    def test_ranger_titulo_humano_sem_caixa_alta(self):
        [g] = m.agrupar([RANGER])
        p = m.gerar_post(g, HOJE)
        self.assertEqual(p['title'], 'Recall Ford Ranger')
        self.assertNotIn('FORD RANGER', texto(p))
        self.assertNotIn('1997', texto(p))
        self.assertIn('para o modelo Ranger (vários anos)', p['content'][0]['text'])
        self.assertEqual(p['slug'], 'recall-ford-ranger-2026-09-24')

    def test_data_em_dd_mm_aaaa(self):
        p = m.gerar_post([RANGER], HOJE)
        self.assertIn('em 24/09/2026', p['content'][0]['text'])
        self.assertNotIn('2026-09-24', p['content'][0]['text'])

    def test_copy_com_acento_e_sem_proibidos(self):
        p = m.gerar_post([RANGER], HOJE)
        t = texto(p)
        for certo in ('O reparo é gratuito', 'fechar negócio', 'A consulta é grátis', 'já foi feito'):
            self.assertIn(certo, t)
        for errado in ('reparo e gratuito', 'negocio', 'consulta e gratis', 'ja foi feito', 'orientacao', 'pagina'):
            self.assertNotIn(errado, t)
        self.assertNotIn('—', t)
        self.assertNotIn('SENATRAN', t.upper())

    def test_usa_dados_da_montadora_em_vez_de_revisar(self):
        p = m.gerar_post([RANGER], HOJE)
        t = texto(p)
        self.assertIn('O conjunto do tubo de saída', t)
        self.assertIn('Inspeção e, se necessário', t)
        self.assertIn('Comunicado oficial: https://www.ford.com.br/', t)
        self.assertNotIn('REVISAR', t)

    def test_campanha_com_varios_modelos_vira_um_post(self):
        grupos = m.agrupar([BRONCO, MAVERICK, RANGER])
        self.assertEqual(sorted(len(g) for g in grupos), [1, 2])
        g = next(g for g in grupos if len(g) == 2)
        p = m.gerar_post(g, HOJE)
        self.assertEqual(p['title'], 'Recall Ford Bronco Sport e Maverick')
        self.assertIn('os modelos Bronco Sport (2025) e Maverick (2025)', p['content'][0]['text'])
        self.assertEqual(p['slug'], 'recall-ford-bronco-sport-maverick-2026-09-03')

    def test_modelos_com_barra_e_componente_no_titulo(self):
        p = m.gerar_post([LAND_ROVER], HOJE)
        self.assertEqual(p['title'], 'Recall Land Rover Defender, Range Rover Sport e Discovery: sistema do motor')
        self.assertIn('Defender (2024 a 2026)', p['content'][0]['text'])
        self.assertIn('até 50 minutos', texto(p))

    def test_capa_padrao(self):
        p = m.gerar_post([RANGER], HOJE)
        self.assertEqual(p['capa']['src'], '/images/blog/recall-padrao.png')
        self.assertEqual(p['capa']['og'], '/images/blog/recall-padrao-1200.png')

    def test_tweet_usa_o_titulo_que_vier_do_post(self):
        self.assertEqual(m.texto_tweet('Recall Ford Ranger: freio', 'recall-ford-ranger-2026-09-24'),
                         'Recall Ford Ranger: freio. Veja o que fazer e se consta para a sua placa: https://placacompleta.com.br/blog/recall-ford-ranger-2026-09-24')

    def test_mesclar_nao_apaga_meses_anteriores(self):
        velho = [{'slug': 'a'}, {'slug': 'b'}]
        self.assertEqual([p['slug'] for p in m.mesclar_posts(velho, [{'slug': 'c'}, {'slug': 'a'}])], ['c', 'a', 'b'])

    def test_ano_humano(self):
        self.assertEqual(m.ano_humano('2025'), '2025')
        self.assertEqual(m.ano_humano('2023 a 2024'), '2023 a 2024')
        self.assertEqual(m.ano_humano('1997 a 2027'), 'vários anos')
        self.assertEqual(m.ano_humano('lixo'), '')


if __name__ == '__main__':
    unittest.main()
