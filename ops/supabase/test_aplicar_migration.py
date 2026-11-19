"""Tests for ops/supabase/aplicar-migration (no network, no database).
Run: python3 -m unittest discover -s ops/supabase -p 'test_*.py'

Isolation: setUpModule blocks sockets and urlopen and points TOKEN_FILE to a
path that does not exist, so no test can reach the Management API with the
real token, even after a regression."""
import importlib.machinery
import socket
import importlib.util
import os
import tempfile
import unittest
from unittest import mock

_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aplicar-migration")
_ld = importlib.machinery.SourceFileLoader("aplicar_migration", _p)
_spec = importlib.util.spec_from_loader("aplicar_migration", _ld)
m = importlib.util.module_from_spec(_spec)
_ld.exec_module(m)


_REDE = []


def _sem_rede(*a, **k):
    raise RuntimeError("network blocked in tests")


def setUpModule():
    for alvo, nome in ((socket.socket, "connect"), (socket.socket, "connect_ex"), (socket, "create_connection"),
                       (m.urllib.request, "urlopen")):
        p = mock.patch.object(alvo, nome, _sem_rede)
        p.start()
        _REDE.append(p)
    p = mock.patch.object(m, "TOKEN_FILE", "/nonexistent/fake-token")
    p.start()
    _REDE.append(p)


def tearDownModule():
    for p in reversed(_REDE):
        p.stop()


class Guarda(unittest.TestCase):
    """The cases of the #782 review, plus strings, identifiers and big files."""

    def recusa(self, sql):
        self.assertTrue(m.guarda(sql), f"should refuse: {sql[:60]!r}")

    def aceita(self, sql):
        self.assertEqual(m.guarda(sql), [], f"should accept: {sql[:60]!r}")

    def test_transaction_control_is_refused_anywhere(self):
        for sql in ("BEGIN;", "begin transaction;", "start transaction;", "commit;", "commit work;", "abort;",
                    "end;", "rollback;", "savepoint s;", "release savepoint s;", "prepare transaction 'x';",
                    "create table t (id int); commit; select 1/0;", "select 1;\nEND;\nselect 2;",
                    "vacuum t;", "VACUUM (FULL) t;", "alter system set work_mem = '4MB';", "create database x;"):
            self.recusa(sql)

    def test_concurrently_is_refused_only_as_code(self):
        self.recusa("create index concurrently i on t (a);")
        self.recusa("drop index concurrently if exists i;")
        self.aceita("-- CONCURRENTLY is not allowed in a transaction\nselect 1;")
        self.aceita("select 1; -- concurrently")
        self.aceita("/* concurrently /* nested */ still a comment */ select 1;")
        self.aceita("comment on table t is 'built concurrently; commit; end;';")

    def test_bodies_strings_and_identifiers_are_ignored(self):
        self.aceita("do $$ begin perform 1; end $$;")
        self.aceita("create function f() returns void language plpgsql as $fn$ begin commit; end $fn$;")
        self.aceita("create function g() returns void language sql as 'select 1; commit;';")
        self.aceita("select E'it\\'s; commit; end' as x;")
        self.aceita('select "end", "begin" from t;')
        self.aceita("select $1 from t;")

    def test_big_file_is_still_checked(self):
        self.recusa("BEGIN;\n" + "select 1;\n" * 60000)  # ~600 KB, past the old pipefail and argv limits

    def test_queue_files_pass(self):
        base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "supabase", "migrations")
        for nome in ("20261119200000_leads_extract_incremental.sql", "20261119210000_drop_unused_indexes.sql",
                     "20261119220000_daily_summaries_before_archiving.sql", "20261119230000_close_anon_inserts.sql",
                     "20261119240000_fcm_tokens_size_limits.sql"):
            p = os.path.join(base, nome)
            if os.path.exists(p):
                with open(p) as f:
                    self.aceita(f.read())


class Isolamento(unittest.TestCase):
    def test_network_and_token_are_out_of_reach(self):
        self.assertNotEqual(m.TOKEN_FILE, "/root/.supabase/access-token")
        with self.assertRaises(Exception):
            m.api("x" * 20, "select 1")


class Corpo(unittest.TestCase):
    def test_file_registration_and_reload_go_in_one_string(self):
        c = m.corpo("create table t (id int) -- no newline at the end", "20261119200000", "leads")
        self.assertTrue(c.startswith("create table t (id int) -- no newline at the end\n;\n"))
        self.assertIn("insert into supabase_migrations.schema_migrations (version, name, statements) "
                      "values ('20261119200000', 'leads', array[$pcmig", c)
        self.assertTrue(c.rstrip().endswith("notify pgrst, 'reload schema';"))

    def test_dollar_tag_never_collides_with_the_file(self):
        with mock.patch.object(m.secrets, "token_hex", side_effect=["aaaa", "bbbb"]):
            self.assertEqual(m.tag_unica("x $pcmigaaaa$ y"), "$pcmigbbbb$")

    def test_rehearsal_rolls_back_and_does_not_notify(self):
        c = m.corpo("select 1;", "20261119200000", "x", ensaio=True)
        self.assertTrue(c.rstrip().endswith("rollback;"))
        self.assertNotIn("notify", c)


class Main(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.log = os.path.join(self.dir, "log")
        p = mock.patch.dict(os.environ, {"PC_MIGRATION_LOG": self.log})
        p.start()
        self.addCleanup(p.stop)
        self.f = os.path.join(self.dir, "20991231000001_teste.sql")
        with open(self.f, "w") as fh:
            fh.write("create table t (id int);\n")

    def run_with(self, respostas, *argv):
        with mock.patch.object(m, "api", side_effect=respostas) as api:
            rc = m.main(list(argv))
        return rc, api

    PROJ_STG = {"name": "placa-completa-staging"}
    PROJ_PROD = {"name": "PlacaCompleta"}

    def test_bad_file_name_is_refused_before_any_call(self):
        bad = os.path.join(self.dir, "20991231000001_Teste'x.sql")
        with open(bad, "w") as fh:
            fh.write("select 1;")
        rc, api = self.run_with([], "staging", bad)
        self.assertEqual(rc, 2)
        api.assert_not_called()

    def test_prod_needs_the_project_name(self):
        rc, api = self.run_with([], "prod", self.f)
        self.assertEqual(rc, 2)
        api.assert_not_called()
        rc, api = self.run_with([], "prod", self.f, "--confirmar-prod", "placacompleta")
        self.assertEqual(rc, 2)

    def test_wrong_project_behind_the_ref_is_refused(self):
        rc, _ = self.run_with([{"name": "outro"}], "staging", self.f)
        self.assertEqual(rc, 2)

    def test_applies_in_a_single_call(self):
        rc, api = self.run_with([self.PROJ_PROD, [], []], "prod", self.f, "--confirmar-prod", "PlacaCompleta")
        self.assertEqual(rc, 0)
        self.assertEqual(api.call_count, 3)  # project, history, the single apply call
        aplicado = api.call_args_list[2][0][1]
        self.assertIn("create table t (id int);", aplicado)
        self.assertIn("insert into supabase_migrations.schema_migrations", aplicado)
        self.assertIn("notify pgrst", aplicado)

    def test_same_content_is_a_no_op(self):
        with open(self.f) as fh:
            conteudo = fh.read()
        rc, api = self.run_with([self.PROJ_STG, [{"statements": [conteudo]}]], "staging", self.f)
        self.assertEqual((rc, api.call_count), (0, 2))

    def test_different_content_warns_and_stops(self):
        rc, api = self.run_with([self.PROJ_STG, [{"statements": ["outra coisa"]}]], "staging", self.f)
        self.assertEqual((rc, api.call_count), (3, 2))
        with open(self.log) as fh:
            self.assertIn("conteudo DIFERENTE", fh.read())

    def test_cli_registration_is_not_compared(self):
        rc, api = self.run_with([self.PROJ_STG, [{"statements": None}]], "staging", self.f)
        self.assertEqual((rc, api.call_count), (0, 2))

    def test_sql_error_means_nothing_applied(self):
        rc, _ = self.run_with([self.PROJ_STG, [], RuntimeError("division by zero")], "staging", self.f)
        self.assertEqual(rc, 1)
        with open(self.log) as fh:
            self.assertIn("FALHOU, nada aplicado nem registrado", fh.read())

    def test_fallen_call_is_unknown_state_and_never_retried(self):
        rc, api = self.run_with([self.PROJ_STG, [], m.EstadoDesconhecido("timed out")], "staging", self.f)
        self.assertEqual((rc, api.call_count), (4, 3))
        with open(self.log) as fh:
            self.assertIn("ESTADO DESCONHECIDO", fh.read())

    def test_dry_run_does_not_apply(self):
        rc, api = self.run_with([self.PROJ_PROD, []], "--dry-run", "prod", self.f)
        self.assertEqual((rc, api.call_count), (0, 2))

    def test_rehearsal_sends_rollback(self):
        rc, api = self.run_with([self.PROJ_STG, [], []], "--ensaio", "staging", self.f)
        self.assertEqual(rc, 0)
        self.assertTrue(api.call_args_list[2][0][1].rstrip().endswith("rollback;"))

    def test_guard_refusal_happens_before_any_call(self):
        with open(self.f, "w") as fh:
            fh.write("create table t (id int); commit; select 1/0;")
        rc, api = self.run_with([], "staging", self.f)
        self.assertEqual(rc, 2)
        api.assert_not_called()


if __name__ == "__main__":
    unittest.main()
