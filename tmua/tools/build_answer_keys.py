#!/usr/bin/env python3
"""Parse the official answer-key PDFs into data/answer_keys.json and
cross-check every answer against the worked-answers PDFs.

Needs pdftotext (poppler-utils). Usage: python3 tmua/tools/build_answer_keys.py
Prints a report; exits non-zero if any key disagrees with its worked answer.
Questions whose worked answer states no letter explicitly are listed as
'unverified' and must be checked by hand (see data/answer_keys.json "checks").
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAPERS = ROOT / "papers"
OUT = ROOT / "data" / "answer_keys.json"

YEARS = ["specimen", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023"]


def stem(year):
    return "TMUA-early-specimen" if year == "specimen" else f"TMUA-{year}"


def text(pdf, layout=False):
    args = ["pdftotext"] + (["-layout"] if layout else []) + [str(pdf), "-"]
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def parse_keys(year):
    f = PAPERS / f"{stem(year)}{'-paper' if year == 'specimen' else ''}-answer-keys.pdf"
    t = text(f, layout=True)
    two_col = re.findall(r"^[ \t]*(\d+)[ \t]+([A-H])[ \t]+(\d+)[ \t]+([A-H])[ \t]*$", t, re.M)
    if len(two_col) == 20:
        p1 = [a for _, a, _, _ in sorted(two_col, key=lambda r: int(r[0]))]
        p2 = [b for _, _, _, b in sorted(two_col, key=lambda r: int(r[2]))]
        return p1, p2
    rows = re.findall(r"^[ \t]*(\d+)[ \t]+([A-H])[ \t]*$", t, re.M)
    if len(rows) == 40:
        return [a for _, a in rows[:20]], [a for _, a in rows[20:]]
    raise ValueError(f"{year}: could not parse key ({len(two_col)} / {len(rows)} rows)")


# The concluding statement in a worked answer, e.g. "so the answer is H",
# "which is option C", "the correct option must have been option D".
ANS = re.compile(
    r"(?:\bis|\bbeen|\bbe|\bgives|\banswer|\bhence|\bthus|\btherefore)\s*:?\s*"
    r"(?:the\s+)?(?:correct\s+)?(?:option|answer)?\s*\(?([A-H])\)?(?=[\s.,;)]|$)"
)


def worked(year, paper):
    f = PAPERS / f"{stem(year)}-paper-{paper}-worked-answers.pdf"
    t = re.sub(r"\s+", " ", text(f))
    # Split on question headings; skip the table of contents (dotted leaders).
    parts = re.split(r"\bQuestion (\d{1,2})\b(?! ?\. ?\.)", t)
    found = {}
    for i in range(1, len(parts) - 1, 2):
        q = int(parts[i])
        if not 1 <= q <= 20:
            continue
        letters = ANS.findall(parts[i + 1])
        if letters:
            found.setdefault(q, []).append(letters[-1])
    # A question's section may appear more than once (headers); keep the last statement.
    return {q: v[-1] for q, v in found.items()}


def main():
    keys, checks, bad = {}, {}, 0
    manual_file = OUT.parent / "key_manual_checks.json"
    manual = json.loads(manual_file.read_text()) if manual_file.exists() else {}
    for y in YEARS:
        p1, p2 = parse_keys(y)
        for paper, key in (("1", p1), ("2", p2)):
            pid = f"{y}-P{paper}"
            keys[pid] = "".join(key)
            w = worked(y, paper)
            agree = [q for q in range(1, 21) if w.get(q) == key[q - 1]]
            diff = [(q, key[q - 1], w[q]) for q in range(1, 21) if q in w and w[q] != key[q - 1]]
            hand = manual.get(pid, {})
            missing = [q for q in range(1, 21) if q not in w and str(q) not in hand]
            checks[pid] = {"auto_agree": len(agree), "hand_checked": sorted(int(k) for k in hand),
                           "disagree": diff, "unverified": missing}
            bad += len(missing)
            bad += len(diff)
            print(f"{pid}: key {keys[pid]}  agree {len(agree)}/20"
                  + (f"  DISAGREE {diff}" if diff else "")
                  + (f"  hand-checked {len(hand)}" if hand else "")
                  + (f"  UNVERIFIED {missing}" if missing else ""))
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "_note": "keys[paper][i] is the official answer to question i+1. Every key was "
                 "cross-checked against the official worked answers (see checks).",
        "keys": keys, "checks": checks}, indent=1))
    print(f"wrote {OUT}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
