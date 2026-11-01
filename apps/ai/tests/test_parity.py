"""The lab parser and the browser's TypeScript port must agree: both check tools/ats-lab/parity/cases.jsonl
(apps/web/tests/ats-parse.test.ts runs the same cases). Regenerate it with `python -m app.lab.parity --write`
after a deliberate parser change, and the TypeScript test tells you whether the port follows."""
import json
from pathlib import Path

import pytest

from app.lab.parity import CASES, expected
from app.lab.parser import parse

ROWS = [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()] if CASES.exists() else []


def test_cases_exist():
    assert len(ROWS) >= 100, f"{CASES} is missing or short"


@pytest.mark.parametrize("row", ROWS, ids=[r["id"] for r in ROWS])
def test_parser_matches_case(row):
    assert expected(parse(row["text"])) == row["expected"]
