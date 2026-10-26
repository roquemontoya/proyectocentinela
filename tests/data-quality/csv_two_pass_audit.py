#!/usr/bin/env python3
"""Centinela two-pass CSV audit prototype — TEST ONLY.

Reads CSVs from a local folder, writes normalized copies to a separate output
folder, and never connects to Supabase. Only the narrowly defined extinguisher
label split pattern is auto-repaired. Other malformed rows are reported, not
guessed at.
"""
import argparse
import csv
import hashlib
import json
import os
import re
from collections import Counter
from pathlib import Path


def read_csv(path):
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as f:
        sample = f.read(8192)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(f, delimiter=dialect.delimiter, quotechar='"', doublequote=True)
        header = next(reader, [])
        rows = list(reader)
    return dialect.delimiter, header, rows


def repair_known_extinguisher_split(filename, delimiter, header, rows):
    repairs = []
    if not filename.lower().startswith("extintores- extintores") or delimiter != ",":
        return repairs
    expected = len(header)
    for index, row in enumerate(rows):
        # High-confidence signature: one extra field, WKT in col 1, extinguisher
        # label ending in "3", next field beginning "5 Kg", and GPS in col 4.
        if len(row) != expected + 1 or len(row) < 4:
            continue
        if not re.match(r"^POINT\\s*\\(", row[0], re.I):
            continue
        if not re.search(r"\\bExtintor\\s+\\d+\\s+\\w+\\s+3\\s*$", row[1], re.I):
            continue
        if not re.match(r"^\\s*5\\s*Kg\\b", row[2], re.I):
            continue
        if not re.search(r"\\b[NS]\\b.*\\b[EW]\\b", row[3], re.I):
            continue
        fixed = row[:1] + [(row[1] + " " + row[2]).strip()] + row[3:]
        if len(fixed) != expected:
            continue
        rows[index] = fixed
        repairs.append({
            "csv_row_number_including_header": index + 2,
            "rule": "EXTINTOR_CAPACIDAD_3_5_NOMBRE_PARTIDO",
            "original_fragments": [row[1], row[2]],
            "repaired_label": fixed[1],
            "checks": ["WKT pattern", "GPS remains in expected column", "column count restored"],
            "status": "TEST_REPAIR_PROPOSED",
        })
    return repairs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    source = Path(args.input_dir).resolve()
    output = Path(args.output_dir).resolve()
    if source == output or source in output.parents:
        raise SystemExit("Output must be separate from the input folder.")
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for path in sorted(source.glob("*.csv")):
        delimiter, header, rows = read_csv(path)
        before = Counter(len(r) for r in rows)
        original_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        repairs = repair_known_extinguisher_split(path.name, delimiter, header, rows)
        after = Counter(len(r) for r in rows)
        target = output / path.name
        with target.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f, delimiter=delimiter, quoting=csv.QUOTE_MINIMAL, lineterminator="\\n")
            writer.writerow(header)
            writer.writerows(rows)
        results.append({
            "file": path.name,
            "original_sha256": original_hash,
            "data_rows": len(rows),
            "header_columns": len(header),
            "column_count_distribution_before": dict(sorted(before.items())),
            "column_count_distribution_after": dict(sorted(after.items())),
            "repairs": repairs,
            "repair_count": len(repairs),
            "status": "REVIEW_REQUIRED" if any(n != len(header) for n in after) else "STRUCTURE_OK",
            "disclaimer": "TEST ONLY — not imported to Supabase",
        })
    report = {
        "title": "Centinela two-pass CSV audit prototype",
        "mode": "LOCAL_TEST_ONLY_NO_SUPABASE",
        "files_processed": len(results),
        "total_data_rows": sum(r["data_rows"] for r in results),
        "policy": "Only high-confidence known 3,5 kg split pattern is repaired. All other structural anomalies remain flagged.",
        "results": results,
    }
    (output / "audit-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"files": len(results), "rows": report["total_data_rows"], "repairs": sum(r["repair_count"] for r in results), "review_required": sum(r["status"] == "REVIEW_REQUIRED" for r in results), "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
