"""Linha "Conversao OpenAI" do pc-venda-origem e primeiro clique do ChatGPT (TST1A23).
Rodar: python3 -m unittest discover -s ops/bin -p 'test_*.py'  (nao toca banco nem e-mail)."""
import importlib.machinery, importlib.util, os, unittest
from unittest import mock

_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pc-venda-origem')
with mock.patch('builtins.open', mock.mock_open(read_data='token')):
    _ld = importlib.machinery.SourceFileLoader('pc_venda_origem', _p)
    _spec = importlib.util.spec_from_loader('pc_venda_origem', _ld)
    m = importlib.util.module_from_spec(_spec)
    _ld.exec_module(m)


class LinhaCapi(unittest.TestCase):
    def test_app_e_teste_nao_se_aplica(self):
        self.assertEqual(m.linha_capi({'openai_capi_erro': 'app'}, 'ChatGPT Ads (OpenAI)'), 'não se aplica (compra no app)')
        self.assertEqual(m.linha_capi({'openai_capi_erro': 'teste'}, 'ChatGPT Ads (OpenAI)'), 'não se aplica (pedido de teste)')
        self.assertEqual(m.linha_capi({'pix_provider': 'google_play'}, 'ChatGPT Ads (OpenAI)'), 'não se aplica (compra no app)')

    def test_venda_de_outra_origem(self):
        self.assertEqual(m.linha_capi({}, 'Google Ads / x'), 'não se aplica (não veio do ChatGPT Ads)')

    def test_chatgpt(self):
        self.assertEqual(m.linha_capi({'openai_capi_em': '2026-10-24T00:40:00Z'}, 'ChatGPT Ads (OpenAI)'), 'enviada à OpenAI')
        self.assertTrue(m.linha_capi({}, 'ChatGPT Ads (OpenAI)').startswith('pendente'))
        self.assertEqual(m.linha_capi({'openai_capi_em': 'x', 'openai_capi_erro': 'velho'}, 'ChatGPT Ads (OpenAI)'), 'não enviada (velho)')


class PrimeiroClique(unittest.TestCase):
    def test_tst1a23_volta_por_chatgpt_com_conta_como_chatgpt_ads(self):
        # Consulta mais recente veio de chatgpt.com (sem oppref); a de 21:27 tinha o clique.
        respostas = [[{'gclid': None, 'utm_source': 'chatgpt.com', 'utm_medium': None, 'utm_campaign': None, 'oppref': None}], [{'?column?': 1}]]
        with mock.patch.object(m, '_cols', return_value='gclid,utm_source,utm_medium,utm_campaign,oppref'), \
             mock.patch.object(m, 'q', side_effect=lambda sql: respostas.pop(0)):
            org = m._origem({'placa': 'TST1A23', 'pago_em': '2026-10-24T00:35:00Z', 'consulta_id': None})
        self.assertEqual(org, 'ChatGPT Ads (OpenAI, clique na consulta grátis)')

    def test_sem_clique_continua_a_origem_da_consulta(self):
        respostas = [[{'gclid': 'g1', 'utm_source': None, 'utm_medium': None, 'utm_campaign': 'c', 'oppref': None}], []]
        with mock.patch.object(m, '_cols', return_value='gclid,utm_source,utm_medium,utm_campaign,oppref'), \
             mock.patch.object(m, 'q', side_effect=lambda sql: respostas.pop(0)):
            org = m._origem({'placa': 'ABC1D23', 'pago_em': '2026-10-24T00:35:00Z', 'consulta_id': None})
        self.assertEqual(org, 'Google Ads / c')


if __name__ == '__main__':
    unittest.main()
