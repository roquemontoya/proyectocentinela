import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("csv_two_pass_audit.py")
spec = importlib.util.spec_from_file_location("csv_two_pass_audit", SCRIPT)
cmu = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cmu)


class KnownRepairRuleTests(unittest.TestCase):
    def setUp(self):
        self.header = [f"col_{i}" for i in range(14)]
        self.good_row = [
            "POINT (1 2)",
            "Extintor 320 Co2 3",
            "5Kg - BOUT DE MONTAJE - Fosa Lado Este",
            "N 123 E 456",
        ] + [f"value_{i}" for i in range(11)]

    def test_repairs_only_high_confidence_35kg_split(self):
        rows = [self.good_row.copy()]
        repairs = cmu.repair_known_extinguisher_split(
            "EXTINTORES- Extintores (4)(1).csv", ",", self.header, rows
        )
        self.assertEqual(len(repairs), 1)
        self.assertEqual(len(rows[0]), len(self.header))
        self.assertIn("3,5Kg", rows[0][1])
        self.assertEqual(rows[0][3], "N 123 E 456")
        self.assertEqual(repairs[0]["status"], "TEST_REPAIR_PROPOSED")

    def test_does_not_repair_when_gps_signature_is_missing(self):
        row = self.good_row.copy()
        row[3] = "not coordinates"
        rows = [row]
        repairs = cmu.repair_known_extinguisher_split(
            "EXTINTORES- Extintores (4)(1).csv", ",", self.header, rows
        )
        self.assertEqual(repairs, [])
        self.assertEqual(rows[0], row)

    def test_does_not_apply_rule_to_other_layers(self):
        rows = [self.good_row.copy()]
        repairs = cmu.repair_known_extinguisher_split(
            "INGENIERIA- Hidrantes (6).csv", ",", self.header, rows
        )
        self.assertEqual(repairs, [])
        self.assertEqual(len(rows[0]), len(self.header) + 1)

    def test_does_not_repair_already_aligned_rows(self):
        row = self.good_row[:-1]
        rows = [row.copy()]
        repairs = cmu.repair_known_extinguisher_split(
            "EXTINTORES- Extintores (4)(1).csv", ",", self.header, rows
        )
        self.assertEqual(repairs, [])
        self.assertEqual(rows[0], row)

    def test_local_run_preserves_original_and_labels_output_test_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "input"
            output = root / "output"
            source.mkdir()
            csv_path = source / "EXTINTORES- Extintores (4)(1).csv"
            import csv
            with csv_path.open("w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(self.header)
                writer.writerow(self.good_row)
            before = csv_path.read_bytes()
            delimiter, header, parsed_rows = cmu.read_csv(csv_path)
            repairs = cmu.repair_known_extinguisher_split(csv_path.name, delimiter, header, parsed_rows)
            self.assertEqual(len(repairs), 1)
            self.assertEqual(csv_path.read_bytes(), before)
            self.assertEqual(len(parsed_rows[0]), len(header))
            self.assertNotEqual(output, source)


if __name__ == "__main__":
    unittest.main()
