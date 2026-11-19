#!/usr/bin/env python3
"""Validate the generated question bank before it is saved or published.

For every question in data/generated_questions.json (or a candidate file
given with --file) this checks:
  1. schema: id, topic code, paper, difficulty, options A.. contiguous (5-8),
     distinct option texts, answer among the options, stem/solution present,
     a distractor note for every wrong option;
  2. answer: runs data/checks/<id>.py, whose check() must independently
     compute the correct option letter (numerically or with sympy) and
     return it; it must equal the stored answer;
  3. originality: if the official PDFs are downloaded (papers/), flags any
     run of 8 consecutive words shared with an official paper.

Usage: python3 tmua/tools/verify_questions.py [--file candidates.json] [--ids g0001,g0002]
Exit status is non-zero if any question fails. Never save a failing question.
"""
import importlib.util
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CHECKS = DATA / "checks"
LETTERS = "ABCDEFGH"


def shingles(text, n=8):
    w = re.findall(r"[a-z0-9]+", text.lower())
    return {" ".join(w[i:i + n]) for i in range(len(w) - n + 1)}


def official_shingles():
    papers = ROOT / "papers"
    out = set()
    for pdf in sorted(papers.glob("TMUA-*-paper-[12].pdf")):
        try:
            out |= shingles(subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout)
        except FileNotFoundError:
            return None
    return out or None


def run_check(qid):
    f = CHECKS / f"{qid}.py"
    if not f.exists():
        return None, f"missing check script {f.relative_to(ROOT)}"
    spec = importlib.util.spec_from_file_location(f"check_{qid}", f)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
        return mod.check(), None
    except Exception as e:  # noqa: BLE001 - report any failure in the check itself
        return None, f"check script raised {type(e).__name__}: {e}"


def validate(q, topics, seen):
    errs = []
    qid = q.get("id", "?")
    if not re.fullmatch(r"g\d{4}", qid):
        errs.append("id must look like g0001")
    if qid in seen:
        errs.append("duplicate id")
    if q.get("topic") not in topics:
        errs.append(f"unknown topic {q.get('topic')}")
    if q.get("paper") not in (1, 2):
        errs.append("paper must be 1 or 2")
    if q.get("difficulty") not in (1, 2, 3):
        errs.append("difficulty must be 1, 2 or 3")
    opts = q.get("options") or {}
    keys = list(opts)
    if not (5 <= len(keys) <= 8) or keys != list(LETTERS[: len(keys)]):
        errs.append("options must be A, B, C... in order, 5 to 8 of them")
    norm = [re.sub(r"\s+", "", str(v)) for v in opts.values()]
    if len(set(norm)) != len(norm):
        errs.append("two options have the same text")
    if q.get("answer") not in opts:
        errs.append("answer is not one of the options")
    for field in ("stem", "solution"):
        if not str(q.get(field, "")).strip():
            errs.append(f"missing {field}")
    d = q.get("distractors") or {}
    missing = [k for k in keys if k != q.get("answer") and not str(d.get(k, "")).strip()]
    if missing:
        errs.append(f"no distractor note for {''.join(missing)}")
    got, err = run_check(qid)
    if err:
        errs.append(err)
    elif got != q.get("answer"):
        errs.append(f"check script gives {got!r}, stored answer is {q.get('answer')!r}")
    return errs


def main():
    args = sys.argv[1:]
    src = pathlib.Path(args[args.index("--file") + 1]) if "--file" in args else DATA / "generated_questions.json"
    only = set(args[args.index("--ids") + 1].split(",")) if "--ids" in args else None
    topics = {t["code"] for t in json.loads((DATA / "topics.json").read_text())["topics"]}
    qs = json.loads(src.read_text())["questions"]
    off = official_shingles()
    if off is None:
        print("note: official PDFs not found in papers/, originality check skipped")
    seen, bad = set(), 0
    for q in qs:
        if only and q.get("id") not in only:
            seen.add(q.get("id"))
            continue
        errs = validate(q, topics, seen)
        seen.add(q.get("id"))
        if off is not None:
            text = " ".join([q.get("stem", "")] + [str(v) for v in (q.get("options") or {}).values()])
            overlap = shingles(text) & off
            if overlap:
                errs.append(f"shares wording with an official paper: '{sorted(overlap)[0]}'")
        print(f"{'OK  ' if not errs else 'FAIL'} {q.get('id')}  {q.get('topic')}  answer {q.get('answer')}" + "".join(f"\n      - {e}" for e in errs))
        bad += bool(errs)
    print(f"{len(qs) - bad if not only else len(only) - bad} passed, {bad} failed")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
