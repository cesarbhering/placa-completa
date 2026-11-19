"""Tests for pc-supabase-pgss-snapshot (no network, no database, no R2).
Run: python3 -m unittest discover -s ops/supabase -p 'test_pc_supabase_pgss*.py'

Isolation: setUpModule blocks sockets and urlopen and points TOKEN_FILE,
R2_ENV and PROD_REF at fakes; each test supplies its own sql() and rclone
answers, and the default sql() fails loudly."""
import gzip
import importlib.machinery
import importlib.util
import json
import os
import shutil
import socket
import tempfile
import unittest
import urllib.error
from unittest import mock

_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pc-supabase-pgss-snapshot")
_ld = importlib.machinery.SourceFileLoader("pc_supabase_pgss_snapshot", _p)
_spec = importlib.util.spec_from_loader("pc_supabase_pgss_snapshot", _ld)
m = importlib.util.module_from_spec(_spec)
_ld.exec_module(m)

FAKE_REF = "testtesttesttesttest"
_REDE = []


def _sem_rede(*a, **k):
    raise RuntimeError("network blocked in tests")


def setUpModule():
    for alvo, nome in ((socket.socket, "connect"), (socket.socket, "connect_ex"), (socket, "create_connection"),
                       (m.urllib.request, "urlopen")):
        p = mock.patch.object(alvo, nome, _sem_rede)
        p.start()
        _REDE.append(p)
    for nome, valor in (("TOKEN_FILE", "/nonexistent/fake-token"), ("R2_ENV", "/nonexistent/fake-r2"),
                        ("PROD_REF", "fakeprodfakeprodfake")):
        p = mock.patch.object(m, nome, valor)
        p.start()
        _REDE.append(p)


def tearDownModule():
    for p in reversed(_REDE):
        p.stop()


class FakeR2:
    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="fake-r2-")
        self.calls = []

    def path(self, remote):
        return os.path.join(self.dir, remote.split(":", 1)[1].replace("/", "__"))

    def __call__(self, *args, env=None):
        self.calls.append(args)
        a = [x for x in args if not x.startswith("--")]
        res = mock.Mock(returncode=0, stdout=b"", stderr=b"")
        if a[0] == "lsf" and os.path.exists(self.path(a[1])):
            res.stdout = b"x\n"
        elif a[0] == "copyto":
            if a[2].startswith("pcarq:"):
                if not ("--ignore-existing" in args and os.path.exists(self.path(a[2]))):
                    shutil.copy(a[1], self.path(a[2]))
            else:
                shutil.copy(self.path(a[1]), a[2])
        return res


SNAP = {"tirado_em": "x", "info": {}, "entradas": 3, "fora_por_senha": 2,
        "top": [{"papel": "postgres", "query": "alter role cli_login with password 'segredo1'"},
                {"papel": "service_role", "query": "select 1"}]}


class Base(unittest.TestCase):
    def setUp(self):
        self.r2 = FakeR2()
        for alvo, nome, novo in ((m, "rclone", self.r2), (m, "r2_env", mock.Mock(return_value=({}, "bucket"))),
                                 (m, "sql", mock.Mock(side_effect=AssertionError("unexpected sql() call")))):
            p = mock.patch.object(alvo, nome, novo)
            p.start()
            self.addCleanup(p.stop)

    def tearDown(self):
        shutil.rmtree(self.r2.dir, ignore_errors=True)


class Senhas(unittest.TestCase):
    def test_password_literals_are_masked(self):
        self.assertEqual(m.mascarar("create role x login password 'a1b2'"), "create role x login password '***'")
        self.assertEqual(m.mascarar("ALTER USER y PASSWD  'zz'"), "ALTER USER y PASSWD  '***'")
        self.assertEqual(m.mascarar("select 1"), "select 1")

    def test_the_select_leaves_password_entries_out_and_masks_the_rest(self):
        q = m.QUERY
        self.assertIn("where p.query !~* '(password|passwd)'", q)
        self.assertIn("create\\s+(role|user)", q)
        self.assertIn("regexp_replace(p.query, '((password|passwd)\\s+)''[^'']*''', '\\1''***''', 'gi')", q)


class Snapshot(Base):
    def run_main(self, sql_answer):
        m.sql.side_effect = None
        m.sql.return_value = [{"r": json.loads(json.dumps(sql_answer))}]
        return m.main(["--ref", FAKE_REF, "--dia", "2026-11-19"])

    def test_writes_masked_snapshot_without_replacing(self):
        self.assertEqual(self.run_main(SNAP), 0)
        uploads = [c for c in self.r2.calls if c[0] == "copyto" and c[-1].startswith("pcarq:")]
        self.assertEqual(len(uploads), 1)
        self.assertIn("--ignore-existing", uploads[0])
        with gzip.open(self.r2.path(uploads[0][-1]), "rt") as f:
            gravado = json.load(f)
        self.assertNotIn("segredo1", json.dumps(gravado))
        self.assertIn("password '***'", gravado["top"][0]["query"])

    def test_existing_object_means_no_query(self):
        open(self.r2.path("pcarq:bucket/supabase-arquivo-" + FAKE_REF + "/pgss/2026-11-19.json.gz"), "w").close()
        self.assertEqual(m.main(["--ref", FAKE_REF, "--dia", "2026-11-19"]), 0)  # default sql() would fail loudly


class Retry(unittest.TestCase):
    def call(self, codes):
        resp = mock.MagicMock()
        resp.__enter__.return_value.read.return_value = b"[]"
        side = [urllib.error.HTTPError("u", c, "x", {}, None) if isinstance(c, int) else resp for c in codes]
        with mock.patch("builtins.open", mock.mock_open(read_data="t")), \
             mock.patch.object(m.urllib.request, "urlopen", side_effect=side) as u, mock.patch.object(m.time, "sleep"):
            try:
                m.sql(FAKE_REF, "select 1")
                return u.call_count, None
            except RuntimeError as e:
                return u.call_count, e

    def test_busy_answers_are_retried(self):
        self.assertEqual(self.call([503, "ok"]), (2, None))
        self.assertEqual(self.call([429, 429, "ok"]), (3, None))

    def test_other_errors_are_not_retried(self):
        n, err = self.call([500, "ok"])
        self.assertEqual(n, 1)
        self.assertIsNotNone(err)


class SemMock(unittest.TestCase):
    def test_unmocked_run_cannot_reach_anything(self):
        abertos = []
        real_open = open

        def espia(p, *a, **k):
            abertos.append(str(p))
            return real_open(p, *a, **k)
        with mock.patch("builtins.open", side_effect=espia):
            try:
                rc = m.main([])
            except Exception:
                rc = "exception"
        self.assertNotEqual(rc, 0)
        self.assertNotIn("/root/.supabase/access-token", abertos)
        self.assertNotIn("/root/.r2-credentials", abertos)


if __name__ == "__main__":
    unittest.main()
