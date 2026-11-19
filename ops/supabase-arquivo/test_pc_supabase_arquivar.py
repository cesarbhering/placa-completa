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

CFG = m.TABLES["consultas"]
DAY = dt.date(2026, 8, 3)


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


def rows(n):
    return [{"id": f"00000000-0000-0000-0000-{k:012d}", "created_at": f"2026-08-03T1{k % 10}:00:00+00:00",
             "email": None, "api_response": {"fipe": {"k": k}}} for k in range(n)]


def export_result(rs, n=None, ids=None):
    ids = ids if ids is not None else md5(",".join(sorted(r["id"] for r in rs)))
    return [{"r": {"linhas": rs, "n": len(rs) if n is None else n, "ids_md5": ids,
                   "col_md5": "colmd5", "com_col": len(rs)}}]


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
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="pcarq-test-")
        self.p_state = mock.patch.object(m, "STATE_DIR", self.tmp)
        self.p_state.start()
        self.r2 = FakeR2()
        self.p_rclone = mock.patch.object(m, "rclone", self.r2)
        self.p_rclone.start()
        self.args = argparse.Namespace(ref=m.PROD_REF, prefixo="supabase-arquivo", confirmar=False, pausa=0)
        self.state = m.State("consultas", m.PROD_REF)

    def tearDown(self):
        mock.patch.stopall()
        shutil.rmtree(self.tmp, ignore_errors=True)
        shutil.rmtree(self.r2.dir, ignore_errors=True)


class Helpers(unittest.TestCase):
    def test_day_bounds_use_brasilia_offset(self):
        self.assertEqual(m.day_bounds(DAY), ("2026-08-03 00:00:00-03", "2026-08-04 00:00:00-03"))

    def test_day_where_filters_the_time_column(self):
        self.assertIn("created_at >= '2026-08-03 00:00:00-03'::timestamptz", m.day_where(CFG, DAY))
        self.assertIn("created_at < '2026-08-04 00:00:00-03'::timestamptz", m.day_where(CFG, DAY))

    def test_object_key_is_partitioned_by_month(self):
        self.assertEqual(m.object_key("supabase-arquivo", "consultas", DAY),
                         "supabase-arquivo/consultas/2026/08/2026-08-03")


class Archive(Base):
    def test_archives_uploads_and_verifies(self):
        rs = rows(5)
        with mock.patch.object(m, "sql", return_value=export_result(rs)):
            man = m.archive_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket")
        self.assertEqual(man["linhas"], 5)
        self.assertTrue(man["verificado_em"])
        gz = self.r2.path("pcarq:bucket/supabase-arquivo/consultas/2026/08/2026-08-03.jsonl.gz")
        with gzip.open(gz, "rt") as f:
            lines = [json.loads(x) for x in f]
        self.assertEqual([x["id"] for x in lines], sorted(r["id"] for r in rs))
        self.assertEqual(lines[0]["api_response"], {"fipe": {"k": 0}})
        with open(os.path.join(self.tmp, f"consultas-{m.PROD_REF}.json")) as f:
            saved = json.load(f)
        self.assertIn("2026-08-03", saved)

    def test_second_run_skips_an_archived_day(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(2))) as q:
            m.archive_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket")
            m.archive_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket")
        self.assertEqual(q.call_count, 1)

    def test_refuses_when_count_and_json_disagree(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(3), n=4)):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket")
        self.assertEqual(self.r2.puts, [])

    def test_refuses_when_ids_md5_disagrees(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(3), ids="other")):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket")

    def test_never_overwrites_an_object_missing_from_the_state(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(2))):
            m.archive_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket")
        fresh = m.State("consultas", m.PROD_REF)
        fresh.data = {}
        with mock.patch.object(m, "sql", return_value=export_result(rows(2))):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", CFG, DAY, fresh, {}, "bucket")


class Clear(Base):
    def archived(self, n=4):
        with mock.patch.object(m, "sql", return_value=export_result(rows(n))):
            return m.archive_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket")

    def fp(self, man, **kw):
        r = {"n": man["linhas"], "ids_md5": man["ids_md5"], "col_md5": man["col_md5"], "com_col": man["linhas"]}
        r.update(kw)
        return [{"r": r}]

    def test_not_archived_is_never_cleared(self):
        with mock.patch.object(m, "sql") as q:
            self.assertFalse(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        q.assert_not_called()

    def test_dry_run_does_not_update(self):
        man = self.archived()
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"ok": True}]]) as q:
            self.assertFalse(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 2)
        self.assertFalse(self.state.data["2026-08-03"].get("zerado_em"))

    def test_confirmed_clear_runs_the_update_once(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"ok": True}], [{"n": 4}]]) as q:
            self.assertTrue(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        self.assertIn("processado_ate >= '2026-08-04 00:00:00-03'", q.call_args_list[1][0][1])
        update_sql = q.call_args_list[2][0][1]
        self.assertIn("set api_response = null", update_sql)
        self.assertIn("api_response is not null", update_sql)
        self.assertIn("created_at <= (select processado_ate from public.leads_extracao_estado where id)", update_sql)
        self.assertEqual(self.state.data["2026-08-03"]["zerados"], 4)

    def test_database_changed_since_archive_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", return_value=self.fp(man, n=5)) as q:
            self.assertFalse(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 1)

    def test_corrupted_object_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with open(self.r2.path("pcarq:bucket/supabase-arquivo/consultas/2026/08/2026-08-03.jsonl.gz"), "ab") as f:
            f.write(b"x")
        with mock.patch.object(m, "sql", return_value=self.fp(man)) as q:
            self.assertFalse(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 1)


class LeadsWatermark(Base):
    """R3 of the #776 review: never clear api_response the leads extraction has not read."""
    archived = Clear.archived
    fp = Clear.fp

    def test_day_after_the_watermark_is_not_cleared(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"ok": False}]]) as q:
            self.assertFalse(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 2)
        self.assertFalse(self.state.data["2026-08-03"].get("zerado_em"))

    def test_missing_watermark_table_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), RuntimeError('api 400: relation "public.leads_extracao_estado" does not exist')]) as q:
            self.assertFalse(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 2)

    def test_empty_watermark_table_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), []]) as q:
            self.assertFalse(m.clear_day(self.args, "consultas", CFG, DAY, self.state, {}, "bucket"))
        self.assertEqual(q.call_count, 2)


class Main(Base):
    def test_refuses_to_archive_today(self):
        today = m.today_brt().isoformat()
        with mock.patch("sys.argv", ["x", "consultas", "arquivar", "--dia", today]), \
             mock.patch.object(m, "r2_env", return_value=({}, "bucket")), \
             mock.patch.object(m, "sql") as q:
            self.assertEqual(m.main(), 2)
        q.assert_not_called()


if __name__ == "__main__":
    unittest.main()
