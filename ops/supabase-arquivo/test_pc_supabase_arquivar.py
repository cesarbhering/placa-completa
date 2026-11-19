"""Tests for pc-supabase-arquivar. They touch neither the database nor R2.
Run: python3 -m unittest discover -s ops/supabase-arquivo -p 'test_*.py'"""
import argparse
import datetime as dt
import gzip
import hashlib
import importlib.machinery
import importlib.util
import json
import os
import shutil
import tempfile
import unittest
from unittest import mock

_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pc-supabase-arquivar")
_ld = importlib.machinery.SourceFileLoader("pc_supabase_arquivar", _p)
_spec = importlib.util.spec_from_loader("pc_supabase_arquivar", _ld)
m = importlib.util.module_from_spec(_spec)
_ld.exec_module(m)

DAY = dt.date(2026, 8, 3)


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


def rows(n, time_col="created_at"):
    return [{"id": f"00000000-0000-0000-0000-{k:012d}", time_col: f"2026-08-03T1{k % 10}:00:00+00:00",
             "fonte": "fipe", "api_response": {"fipe": {"k": k}}} for k in range(n)]


def export_result(rs, n=None, ids=None):
    ids = ids if ids is not None else md5(",".join(sorted(r["id"] for r in rs)))
    fp = {"n": len(rs) if n is None else n, "ids_md5": ids, "col_md5": "colmd5"}
    return [{"r": {"linhas": rs, "fp": fp, "com_col": len(rs)}}]


class FakeR2:
    """Keeps uploaded objects in a temp dir and answers the rclone calls the script makes."""

    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="fake-r2-")
        self.puts = []

    def path(self, remote):
        return os.path.join(self.dir, remote.split(":", 1)[1].replace("/", "__"))

    def __call__(self, *args, env=None, check=True, capture=True):
        res = mock.Mock(returncode=0, stdout=b"", stderr=b"")
        if args[0] == "copyto":
            src, dst = args[1], args[2]
            if dst.startswith("pcarq:"):
                shutil.copy(src, self.path(dst))
                self.puts.append(dst)
            else:
                shutil.copy(self.path(src), dst)
        elif args[0] == "lsf":
            if os.path.exists(self.path(args[1])):
                res.stdout = b"x\n"
        return res


class Base(unittest.TestCase):
    table = "consultas"

    def setUp(self):
        self.cfg = m.TABLES[self.table]
        self.tmp = tempfile.mkdtemp(prefix="pcarq-test-")
        mock.patch.object(m, "STATE_DIR", self.tmp).start()
        self.r2 = FakeR2()
        mock.patch.object(m, "rclone", self.r2).start()
        self.args = argparse.Namespace(ref=m.PROD_REF, prefixo="supabase-arquivo", confirmar=False, pausa=0)
        self.state = m.State(self.table, m.PROD_REF)

    def tearDown(self):
        mock.patch.stopall()
        shutil.rmtree(self.tmp, ignore_errors=True)
        shutil.rmtree(self.r2.dir, ignore_errors=True)

    def key(self):
        return f"pcarq:bucket/supabase-arquivo/{self.table}/2026/08/2026-08-03.jsonl.gz"

    def archived(self, n=4):
        with mock.patch.object(m, "sql", return_value=export_result(rows(n, self.cfg["time_col"]))):
            return m.archive_day(self.args, self.table, self.cfg, DAY, self.state, {}, "bucket")

    def fp(self, man, **kw):
        r = {"n": man["linhas"], "ids_md5": man["ids_md5"], "col_md5": man["col_md5"], "com_col": man["linhas"]}
        r.update(kw)
        return [{"r": r}]


class Helpers(unittest.TestCase):
    def test_day_bounds_use_brasilia_offset(self):
        self.assertEqual(m.day_bounds(DAY), ("2026-08-03 00:00:00-03", "2026-08-04 00:00:00-03"))

    def test_day_where_filters_the_time_column_of_the_alias(self):
        w = m.day_where(m.TABLES["eventos_funil"], DAY, "x")
        self.assertIn("x.criado_em >= '2026-08-03 00:00:00-03'::timestamptz", w)
        self.assertIn("x.criado_em < '2026-08-04 00:00:00-03'::timestamptz", w)

    def test_object_key_is_partitioned_by_month(self):
        self.assertEqual(m.object_key("supabase-arquivo", "consultas", DAY),
                         "supabase-arquivo/consultas/2026/08/2026-08-03")

    def test_paid_api_sources_are_never_deleted(self):
        self.assertIn("not in ('wdapi', 'placafipe')", m.TABLES["api_chamadas"]["delete_where"])


class Archive(Base):
    def test_archives_uploads_and_verifies(self):
        man = self.archived(5)
        self.assertEqual(man["linhas"], 5)
        self.assertTrue(man["verificado_em"])
        with gzip.open(self.r2.path(self.key()), "rt") as f:
            lines = [json.loads(x) for x in f]
        self.assertEqual([x["id"] for x in lines], sorted(x["id"] for x in lines))
        self.assertEqual(lines[0]["api_response"], {"fipe": {"k": 0}})
        with open(os.path.join(self.tmp, f"consultas-{m.PROD_REF}.json")) as f:
            self.assertIn("2026-08-03", json.load(f))

    def test_second_run_skips_an_archived_day(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(2))) as q:
            m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
            m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        self.assertEqual(q.call_count, 1)

    def test_refuses_when_count_and_json_disagree(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(3), n=4)):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        self.assertEqual(self.r2.puts, [])

    def test_refuses_when_ids_md5_disagrees(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(3), ids="other")):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")

    def test_never_overwrites_an_object_missing_from_the_state(self):
        self.archived(2)
        fresh = m.State("consultas", m.PROD_REF)
        fresh.data = {}
        with mock.patch.object(m, "sql", return_value=export_result(rows(2))):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", self.cfg, DAY, fresh, {}, "bucket")


class Clear(Base):
    def test_not_archived_is_never_touched(self):
        with mock.patch.object(m, "sql") as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        q.assert_not_called()

    def test_dry_run_does_not_update(self):
        man = self.archived()
        with mock.patch.object(m, "sql", return_value=self.fp(man)) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 1)
        self.assertFalse(m.released(self.state.data["2026-08-03"]))

    def test_confirmed_clear_runs_the_update_once(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"n": 4}]]) as q:
            self.assertTrue(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        update_sql = q.call_args_list[1][0][1]
        self.assertIn("set api_response = null", update_sql)
        self.assertIn("t.api_response is not null", update_sql)
        self.assertEqual(self.state.data["2026-08-03"]["zerados"], 4)

    def test_database_changed_since_archive_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", return_value=self.fp(man, n=5)) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 1)

    def test_corrupted_object_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with open(self.r2.path(self.key()), "ab") as f:
            f.write(b"x")
        with mock.patch.object(m, "sql", return_value=self.fp(man)) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 1)


class Delete(Base):
    table = "api_chamadas"

    def test_dry_run_neither_summarizes_nor_deletes(self):
        man = self.archived()
        with mock.patch.object(m, "sql", return_value=self.fp(man)) as q:
            self.assertFalse(m.release_day(self.args, self.table, self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 1)

    def test_summarizes_then_deletes_with_the_guard(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"n": 7}], [{"n": 4, "apagados": 3}]]) as q:
            self.assertTrue(m.release_day(self.args, self.table, self.cfg, DAY, self.state, {}, "bucket"))
        resumo_sql, delete_sql = q.call_args_list[1][0][1], q.call_args_list[2][0][1]
        self.assertIn("public.api_chamadas_resumir('2026-08-03'::date)", resumo_sql)
        self.assertIn("delete from public.api_chamadas x using fp", delete_sql)
        self.assertIn("x.fonte not in ('wdapi', 'placafipe')", delete_sql)
        self.assertIn(f"fp.n = 4 and fp.ids_md5 = '{man['ids_md5']}' and fp.col_md5 = '{man['col_md5']}'", delete_sql)
        st = self.state.data["2026-08-03"]
        self.assertEqual((st["resumo"], st["apagados"]), (7, 3))

    def test_day_changed_inside_the_statement_is_not_marked(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"n": 7}], [{"n": 5, "apagados": 0}]]):
            self.assertFalse(m.release_day(self.args, self.table, self.cfg, DAY, self.state, {}, "bucket"))
        self.assertFalse(m.released(self.state.data["2026-08-03"]))


class Main(Base):
    def test_refuses_to_archive_today(self):
        today = m.today_brt().isoformat()
        with mock.patch("sys.argv", ["x", "consultas", "arquivar", "--dia", today]), \
             mock.patch.object(m, "r2_env", return_value=({}, "bucket")), \
             mock.patch.object(m, "sql") as q:
            self.assertEqual(m.main(), 2)
        q.assert_not_called()



class Vacuum(Base):
    def test_plain_vacuum_after_every_n_days_and_at_the_end(self):
        self.args.confirmar, self.args.vacuum_a_cada = True, 2
        days = [DAY + dt.timedelta(days=k) for k in range(5)]
        with mock.patch.object(m, "release_day", return_value=True), \
             mock.patch.object(m, "sql") as q, mock.patch.object(m.time, "sleep"):
            self.assertEqual(m.release_days(self.args, "consultas", self.cfg, days, self.state, {}, "bucket"), 5)
        vac = [c for c in q.call_args_list if c[0][1].startswith("vacuum public.consultas")]
        self.assertEqual(len(vac), 3)  # after day 2, after day 4, and the leftover day 5

    def test_dry_run_never_vacuums(self):
        self.args.vacuum_a_cada = 1
        with mock.patch.object(m, "release_day", return_value=False), \
             mock.patch.object(m, "sql") as q, mock.patch.object(m.time, "sleep"):
            m.release_days(self.args, "consultas", self.cfg, [DAY], self.state, {}, "bucket")
        q.assert_not_called()


if __name__ == "__main__":
    unittest.main()
