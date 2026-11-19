"""Tests for pc-supabase-arquivar. They touch neither the database nor R2.
Run: python3 -m unittest discover -s ops/supabase-arquivo -p 'test_*.py'

The dangerous paths are asserted on behavior and on the SQL that reaches the
database: the day filter and the fingerprint inside the write, the 7-day
window, the leads watermark, the A16 guard, no write without --confirmar,
no upload that replaces an object, and no write when R2 does not answer."""
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
import urllib.error
from unittest import mock

_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pc-supabase-arquivar")
_ld = importlib.machinery.SourceFileLoader("pc_supabase_arquivar", _p)
_spec = importlib.util.spec_from_loader("pc_supabase_arquivar", _ld)
m = importlib.util.module_from_spec(_spec)
_ld.exec_module(m)

DAY = dt.date(2026, 8, 3)


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


def rows(n, time_col="created_at", day="2026-08-03"):
    return [{"id": f"00000000-0000-0000-0000-{k:012d}", time_col: f"{day}T1{k % 10}:00:00+00:00",
             "fonte": "fipe", "api_response": {"fipe": {"k": k}}} for k in range(n)]


def export_result(rs, n=None, ids=None):
    ids = ids if ids is not None else md5(",".join(sorted(r["id"] for r in rs)))
    fp = {"n": len(rs) if n is None else n, "ids_md5": ids, "col_md5": "colmd5"}
    return [{"r": {"linhas": rs, "fp": fp, "com_col": len(rs)}}]


def writes(q):
    """SQL calls that change data (anything but the reads of the script)."""
    out = []
    for c in q.call_args_list:
        s = c[0][1].lower()
        if "update public." in s or "delete from public." in s or "_resumir(" in s or s.startswith("vacuum"):
            out.append(c[0][1])
    return out


class FakeR2:
    """Objects in a temp dir; answers the rclone calls of the script. fail_lsf
    simulates a broken listing, corrupt_upload an object damaged in transit."""

    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="fake-r2-")
        self.puts = []
        self.fail_lsf = False
        self.corrupt_upload = False

    def path(self, remote):
        return os.path.join(self.dir, remote.split(":", 1)[1].replace("/", "__"))

    def __call__(self, *args, env=None, check=True, capture=True):
        res = mock.Mock(returncode=0, stdout=b"", stderr=b"")
        a = [x for x in args if not x.startswith("--")]
        if a[0] == "lsf":
            if self.fail_lsf:
                res.returncode = 5
            elif os.path.exists(self.path(a[1])):
                res.stdout = b"x\n"
        elif a[0] == "copyto":
            src, dst = a[1], a[2]
            if dst.startswith("pcarq:"):
                if "--ignore-existing" in args and os.path.exists(self.path(dst)):
                    return res
                shutil.copy(src, self.path(dst))
                if self.corrupt_upload and dst.endswith(".gz"):
                    with open(self.path(dst), "ab") as f:
                        f.write(b"x")
                self.puts.append((dst, "--ignore-existing" in args))
            else:
                shutil.copy(self.path(src), dst)
        if check and res.returncode != 0:
            raise RuntimeError(f"rclone {a[0]} failed (rc {res.returncode})")
        return res


class Base(unittest.TestCase):
    table = "consultas"

    def setUp(self):
        self.cfg = m.TABLES[self.table]
        self.tmp = tempfile.mkdtemp(prefix="pcarq-test-")
        mock.patch.object(m, "STATE_DIR", self.tmp).start()
        self.r2 = FakeR2()
        mock.patch.object(m, "rclone", self.r2).start()
        mock.patch.object(m.time, "sleep").start()
        self.args = argparse.Namespace(ref=m.PROD_REF, prefixo="supabase-arquivo", confirmar=False, pausa=0,
                                       vacuum_a_cada=0, limite=100)
        self.state = m.State(self.table, m.PROD_REF)

    def tearDown(self):
        mock.patch.stopall()
        shutil.rmtree(self.tmp, ignore_errors=True)
        shutil.rmtree(self.r2.dir, ignore_errors=True)

    def key(self, day="2026-08-03"):
        return f"pcarq:bucket/supabase-arquivo/{self.table}/{day[:4]}/{day[5:7]}/{day}.jsonl.gz"

    def archived(self, n=4, day=DAY):
        with mock.patch.object(m, "sql", return_value=export_result(rows(n, self.cfg["time_col"], day.isoformat()))):
            return m.archive_day(self.args, self.table, self.cfg, day, self.state, {}, "bucket")

    def fp(self, man, **kw):
        r = {"n": man["linhas"], "ids_md5": man["ids_md5"], "col_md5": man["col_md5"], "com_col": man["linhas"]}
        r.update(kw)
        return [{"r": r}]

    def release_ok(self, man, feitos=None):
        n = man["linhas"] if feitos is None else feitos
        return [{"fp": {"n": man["linhas"], "ids_md5": man["ids_md5"], "col_md5": man["col_md5"]},
                 "alvo": man["linhas"], "feitos": n}]

    GUARD_OK = [{"marca_ok": True, "sem_insert_aberto": True}]


class Helpers(unittest.TestCase):
    def test_day_bounds_use_brasilia_offset(self):
        self.assertEqual(m.day_bounds(DAY), ("2026-08-03 00:00:00-03", "2026-08-04 00:00:00-03"))

    def test_day_where_filters_both_ends_of_the_day(self):
        w = m.day_where(m.TABLES["eventos_funil"], DAY, "x")
        self.assertIn("x.criado_em >= '2026-08-03 00:00:00-03'::timestamptz", w)
        self.assertIn("x.criado_em < '2026-08-04 00:00:00-03'::timestamptz", w)

    def test_object_key_is_partitioned_by_month(self):
        self.assertEqual(m.object_key("supabase-arquivo", "consultas", DAY),
                         "supabase-arquivo/consultas/2026/08/2026-08-03")

    def test_paid_api_sources_are_never_deleted(self):
        self.assertIn("not in ('wdapi', 'placafipe')", m.TABLES["api_chamadas"]["delete_where"])

    def test_relatorio_aberturas_keeps_180_days(self):
        c = m.TABLES["relatorio_aberturas"]
        self.assertEqual((c["mode"], c["time_col"], c["keep_days"]), ("delete", "aberto_em", 180))


class Archive(Base):
    def test_archives_uploads_without_replacing_and_verifies(self):
        man = self.archived(5)
        self.assertEqual(man["linhas"], 5)
        self.assertTrue(man["verificado_em"])
        self.assertEqual(len(self.r2.puts), 2)
        self.assertTrue(all(flag for _, flag in self.r2.puts), "every upload must use --ignore-existing")
        with gzip.open(self.r2.path(self.key()), "rt") as f:
            lines = [json.loads(x) for x in f]
        self.assertEqual([x["id"] for x in lines], sorted(x["id"] for x in lines))
        self.assertEqual(lines[0]["api_response"], {"fipe": {"k": 0}})

    def test_archive_never_writes_to_the_database(self):
        with mock.patch.object(m, "sql", return_value=export_result(rows(3))) as q:
            m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        self.assertEqual(writes(q), [])
        self.assertIn("2026-08-03 00:00:00-03", q.call_args[0][1])

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
        self.assertEqual(self.r2.puts, [])

    def test_existing_object_missing_from_the_state_is_never_replaced(self):
        self.archived(2)
        with open(self.r2.path(self.key()), "rb") as f:
            original = f.read()
        fresh = m.State("consultas", m.PROD_REF)
        fresh.data = {}
        with mock.patch.object(m, "sql", return_value=export_result(rows(3))):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", self.cfg, DAY, fresh, {}, "bucket")
        with open(self.r2.path(self.key()), "rb") as f:
            self.assertEqual(f.read(), original)

    def test_listing_error_stops_before_any_upload(self):
        self.r2.fail_lsf = True
        with mock.patch.object(m, "sql", return_value=export_result(rows(2))):
            with self.assertRaises(RuntimeError):
                m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        self.assertEqual(self.r2.puts, [])
        self.assertNotIn("2026-08-03", self.state.data)

    def test_object_damaged_in_the_upload_is_caught_right_away(self):
        self.r2.corrupt_upload = True
        with mock.patch.object(m, "sql", return_value=export_result(rows(2))):
            with self.assertRaisesRegex(RuntimeError, "verification after upload failed"):
                m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        self.assertNotIn("2026-08-03", self.state.data)

    def test_plain_text_never_goes_to_tmp(self):
        seen = []
        real = m.work_dir

        def spy():
            d = real()
            seen.append(d.name)
            return d
        with mock.patch.object(m, "work_dir", side_effect=spy), \
             mock.patch.object(m, "sql", return_value=export_result(rows(2))):
            m.archive_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        self.assertTrue(seen and all(p.startswith(os.path.join(self.tmp, "tmp")) for p in seen))


class Clear(Base):
    def test_not_archived_is_never_touched(self):
        with mock.patch.object(m, "sql") as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        q.assert_not_called()

    def test_dry_run_neither_writes_nor_marks(self):
        man = self.archived()
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), self.GUARD_OK, self.release_ok(man)]) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(writes(q), [])
        self.assertFalse(m.released(self.state.data["2026-08-03"]))

    def test_dry_run_with_nothing_left_does_not_mark_the_state(self):
        man = self.archived()
        with mock.patch.object(m, "sql", return_value=self.fp(man, com_col=0)):
            m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        self.assertFalse(m.released(self.state.data["2026-08-03"]))

    def test_confirmed_clear_is_one_guarded_statement(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), self.GUARD_OK, self.release_ok(man)]) as q:
            self.assertTrue(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        w = writes(q)
        self.assertEqual(len(w), 1)
        s = w[0]
        self.assertIn("for update", s)
        self.assertIn("t.created_at >= '2026-08-03 00:00:00-03'::timestamptz", s)
        self.assertIn("t.created_at < '2026-08-04 00:00:00-03'::timestamptz", s)
        self.assertIn("x.id = a.id", s)
        self.assertIn(f"fp.n = {man['linhas']}", s)
        self.assertIn(f"fp.ids_md5 = '{man['ids_md5']}'", s)
        self.assertIn(f"fp.col_md5 = '{man['col_md5']}'", s)
        self.assertIn("x.created_at < now() - interval '7 days'", s)
        self.assertIn("x.created_at <= (select processado_ate from public.leads_extracao_estado where id)", s)
        self.assertIn("polcmd in ('a', '*')", s)
        self.assertEqual(self.state.data["2026-08-03"]["zerados"], man["linhas"])

    def test_only_ids_md5_differs_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man, ids_md5="outro"), self.GUARD_OK, self.release_ok(man)]) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(writes(q), [])

    def test_only_col_md5_differs_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man, col_md5="outro"), self.GUARD_OK, self.release_ok(man)]) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(writes(q), [])

    def test_only_count_differs_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man, n=5), self.GUARD_OK, self.release_ok(man)]) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(writes(q), [])

    def test_corrupted_object_blocks_the_clear(self):
        man = self.archived()
        self.args.confirmar = True
        with open(self.r2.path(self.key()), "ab") as f:
            f.write(b"x")
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), self.GUARD_OK, self.release_ok(man)]) as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(writes(q), [])

    def test_manifest_of_another_day_blocks_the_clear(self):
        man = self.archived()
        self.state.data["2026-08-03"]["dia"] = "2026-08-04"
        self.args.confirmar = True
        with mock.patch.object(m, "sql") as q:
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        q.assert_not_called()

    def test_day_changed_inside_the_statement_is_not_marked(self):
        man = self.archived()
        self.args.confirmar = True
        changed = [{"fp": {"n": man["linhas"] + 1, "ids_md5": "x", "col_md5": "y"}, "alvo": 5, "feitos": 0}]
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), self.GUARD_OK, changed]):
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertFalse(m.released(self.state.data["2026-08-03"]))

    def test_partial_clear_leaves_the_day_open(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), self.GUARD_OK, self.release_ok(man, feitos=1)]):
            self.assertFalse(m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket"))
        self.assertFalse(m.released(self.state.data["2026-08-03"]))


class Guards(Base):
    """R3 of the #776 review and the A16 condition of the #777 review."""

    def run_with(self, guard):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), guard, self.release_ok(man)]) as q:
            ok = m.release_day(self.args, "consultas", self.cfg, DAY, self.state, {}, "bucket")
        return ok, q

    def test_day_after_the_leads_watermark_is_not_cleared(self):
        ok, q = self.run_with([{"marca_ok": False, "sem_insert_aberto": True}])
        self.assertFalse(ok)
        self.assertEqual(writes(q), [])
        g = q.call_args_list[1][0][1]
        self.assertIn("leads_extracao_estado", g)
        self.assertIn(">= '2026-08-04 00:00:00-03'::timestamptz", g)

    def test_open_insert_policy_blocks_the_clear(self):
        ok, q = self.run_with([{"marca_ok": True, "sem_insert_aberto": False}])
        self.assertFalse(ok)
        self.assertEqual(writes(q), [])

    def test_missing_watermark_table_blocks_the_clear(self):
        ok, q = self.run_with(RuntimeError('api 400: relation "public.leads_extracao_estado" does not exist'))
        self.assertFalse(ok)
        self.assertEqual(writes(q), [])

    def test_empty_answer_blocks_the_clear(self):
        ok, q = self.run_with([])
        self.assertFalse(ok)
        self.assertEqual(writes(q), [])

    def test_tables_without_the_guard_skip_it(self):
        for t in ("api_chamadas", "eventos_funil", "relatorio_aberturas"):
            self.assertNotIn("guard_check", m.TABLES[t])


class Delete(Base):
    table = "api_chamadas"

    def test_dry_run_neither_summarizes_nor_deletes(self):
        man = self.archived()
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"n": 7}], self.release_ok(man)]) as q:
            self.assertFalse(m.release_day(self.args, self.table, self.cfg, DAY, self.state, {}, "bucket"))
        self.assertEqual(writes(q), [])

    def test_summarizes_then_deletes_in_one_guarded_statement(self):
        man = self.archived()
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.fp(man), [{"n": 7}], self.release_ok(man, feitos=3)]) as q:
            q.side_effect = [self.fp(man), [{"n": 7}],
                             [{"fp": {"n": man["linhas"], "ids_md5": man["ids_md5"], "col_md5": man["col_md5"]},
                               "alvo": 3, "feitos": 3}]]
            self.assertTrue(m.release_day(self.args, self.table, self.cfg, DAY, self.state, {}, "bucket"))
        w = writes(q)
        self.assertIn("public.api_chamadas_resumir('2026-08-03'::date)", w[0])
        d = w[1]
        self.assertIn("delete from public.api_chamadas x using alvo a, fp", d)
        self.assertIn("for update", d)
        self.assertIn("t.criado_em >= '2026-08-03 00:00:00-03'::timestamptz", d)
        self.assertIn("x.fonte not in ('wdapi', 'placafipe')", d)
        self.assertIn("a.fonte not in ('wdapi', 'placafipe')", d)
        self.assertIn("x.criado_em < now() - interval '30 days'", d)
        self.assertIn(f"fp.ids_md5 = '{man['ids_md5']}'", d)
        st = self.state.data["2026-08-03"]
        self.assertEqual((st["resumo"], st["apagados"]), (7, 3))


class Windows(Base):
    """The release window: never inside keep_days, never past --ate."""

    def seed(self, days):
        for d in days:
            self.state.data[d.isoformat()] = {"verificado_em": "x", "linhas": 1, "bytes_gz": 1}

    def released_days(self, argv):
        calls = []
        with mock.patch("sys.argv", ["x", *argv]), \
             mock.patch.object(m, "r2_env", return_value=({}, "bucket")), \
             mock.patch.object(m, "State", return_value=self.state), \
             mock.patch.object(m, "release_day", side_effect=lambda a, t, c, d, *r: calls.append(d) or False):
            m.main()
        return calls

    def test_liberar_respects_the_7_day_window_and_ate(self):
        today = m.today_brt()
        days = [today - dt.timedelta(days=k) for k in range(1, 15)]
        self.seed(days)
        got = self.released_days(["consultas", "liberar", "--ate", today.isoformat()])
        self.assertTrue(got)
        self.assertTrue(all(d <= today - dt.timedelta(days=8) for d in got))
        got = self.released_days(["consultas", "liberar", "--ate", (today - dt.timedelta(days=12)).isoformat()])
        self.assertTrue(all(d <= today - dt.timedelta(days=12) for d in got))
        self.assertEqual(len(got), 3)

    def test_diario_archives_every_missing_day(self):
        today = m.today_brt()
        self.seed([today - dt.timedelta(days=5)])
        archived = []
        with mock.patch("sys.argv", ["x", "consultas", "diario"]), \
             mock.patch.object(m, "r2_env", return_value=({}, "bucket")), \
             mock.patch.object(m, "State", return_value=self.state), \
             mock.patch.object(m, "archive_day", side_effect=lambda a, t, c, d, *r: archived.append(d)), \
             mock.patch.object(m, "release_day", return_value=False):
            m.main()
        self.assertEqual(archived, [today - dt.timedelta(days=k) for k in (4, 3, 2, 1)])

    def test_status_reports_gaps(self):
        self.seed([DAY, DAY + dt.timedelta(days=2)])
        self.assertEqual(m.gaps(self.state), [DAY + dt.timedelta(days=1)])


class Vacuum(Base):
    def test_plain_vacuum_after_every_n_days_and_at_the_end(self):
        self.args.confirmar, self.args.vacuum_a_cada = True, 2
        days = [DAY + dt.timedelta(days=k) for k in range(5)]
        with mock.patch.object(m, "release_day", return_value=True), mock.patch.object(m, "sql") as q:
            self.assertEqual(m.release_days(self.args, "consultas", self.cfg, days, self.state, {}, "bucket"), 5)
        self.assertEqual(len([c for c in q.call_args_list if c[0][1].startswith("vacuum public.consultas")]), 3)

    def test_dry_run_never_vacuums(self):
        self.args.vacuum_a_cada = 1
        with mock.patch.object(m, "release_day", return_value=False), mock.patch.object(m, "sql") as q:
            m.release_days(self.args, "consultas", self.cfg, [DAY], self.state, {}, "bucket")
        q.assert_not_called()


class Prune(Base):
    table = "placa_cache"

    def cache_rows(self):
        return [{"placa": "ABC1D23", "fetched_at": "2026-08-22T10:00:00.123456+00:00", "encontrado": False, "payload": {}},
                {"placa": "XYZ9Z99", "fetched_at": "2026-08-23T11:00:00+00:00", "encontrado": True, "payload": {"a": 1}}]

    def result(self, rs):
        return [{"r": {"linhas": rs, "fp": {"n": len(rs), "ids_md5": "i", "col_md5": "c"}}}]

    def test_predicate_spares_paid_plates_and_fresh_rows(self):
        w = self.cfg["prune_where"]
        self.assertIn("t.encontrado = false and t.fetched_at < now() - interval '6 hours'", w)
        self.assertIn("interval '90 days'", w)
        self.assertIn("pp.pago_em is not null", w)

    def test_dry_run_neither_uploads_nor_deletes(self):
        with mock.patch.object(m, "sql", return_value=self.result(self.cache_rows())) as q:
            self.assertEqual(m.prune(self.args, self.table, self.cfg, self.state, {}, "bucket"), 0)
        self.assertEqual(writes(q), [])
        self.assertEqual(self.r2.puts, [])

    def test_deletes_exactly_the_archived_rows_still_matching(self):
        self.args.confirmar = True
        with mock.patch.object(m, "sql", side_effect=[self.result(self.cache_rows()), [{"apagados": 2}]]) as q:
            self.assertEqual(m.prune(self.args, self.table, self.cfg, self.state, {}, "bucket"), 2)
        d = writes(q)[0]
        self.assertIn("('ABC1D23', '2026-08-22T10:00:00.123456+00:00'::timestamptz)", d)
        self.assertIn("t.placa = alvo.k and t.fetched_at = alvo.ts", d)
        self.assertIn("pp.pago_em is not null", d)

    def test_other_actions_are_refused_for_placa_cache(self):
        with mock.patch("sys.argv", ["x", "placa_cache", "liberar", "--ate", "2026-08-01"]), \
             mock.patch.object(m, "r2_env", return_value=({}, "bucket")), \
             mock.patch.object(m, "sql") as q:
            self.assertEqual(m.main(), 2)
        q.assert_not_called()


class Main(Base):
    def test_refuses_to_archive_today(self):
        today = m.today_brt().isoformat()
        with mock.patch("sys.argv", ["x", "consultas", "arquivar", "--dia", today]), \
             mock.patch.object(m, "r2_env", return_value=({}, "bucket")), \
             mock.patch.object(m, "sql") as q:
            self.assertEqual(m.main(), 2)
        q.assert_not_called()


class Api(unittest.TestCase):
    def http_error(self, code):
        return urllib.error.HTTPError("u", code, "x", {}, None)

    def call(self, effects):
        resp = mock.MagicMock()
        resp.__enter__.return_value.read.return_value = b"[]"
        side = [self.http_error(c) if isinstance(c, int) else resp for c in effects]
        with mock.patch("builtins.open", mock.mock_open(read_data="t")), \
             mock.patch.object(m.urllib.request, "urlopen", side_effect=side) as u, \
             mock.patch.object(m.time, "sleep"):
            try:
                m.sql("ref", "select 1")
                return u.call_count, None
            except RuntimeError as e:
                return u.call_count, e

    def test_gateway_errors_are_not_retried(self):
        for code in (500, 502, 504):
            n, err = self.call([code, "ok"])
            self.assertEqual(n, 1)
            self.assertIsNotNone(err)

    def test_busy_answers_are_retried(self):
        for code in (429, 503):
            n, err = self.call([code, "ok"])
            self.assertEqual((n, err), (2, None))


if __name__ == "__main__":
    unittest.main()
