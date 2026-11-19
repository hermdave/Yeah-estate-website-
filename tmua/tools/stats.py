#!/usr/bin/env python3
"""Summarise study data: accuracy by topic, mistake reasons, time per topic.

Input is either
  * a folder written by ArtifactData reads with out_dir (it holds attempts/*.json
    and errors/*.json), or
  * a backup file exported from the dashboard (Progress > Backup > Export JSON).

Usage: python3 tmua/tools/stats.py <folder-or-backup.json> [--weakest N]
Prints a report and, last, a JSON line {"weakest": [...]} that the
generation workflow in CLAUDE.md uses.
"""
import json
import pathlib
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def load(src):
    p = pathlib.Path(src)
    if p.is_file():
        d = json.loads(p.read_text())
        return list(d.get("attempts", {}).values()), list(d.get("errors", {}).values())
    out = []
    for coll in ("attempts", "errors"):
        docs = []
        for f in sorted(p.rglob(f"{coll}/*.json")):
            j = json.loads(f.read_text())
            docs.append(j.get("data", j) if isinstance(j, dict) else j)
        out.append(docs)
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    k = int(sys.argv[sys.argv.index("--weakest") + 1]) if "--weakest" in sys.argv else 3
    attempts, errors = load(sys.argv[1])
    keys = {pid: list(v) for pid, v in json.loads((DATA / "answer_keys.json").read_text())["keys"].items()}
    tags = json.loads((DATA / "question_tags.json").read_text())["papers"]
    topics = {t["code"]: t["name"] for t in json.loads((DATA / "topics.json").read_text())["topics"]}
    bank = {q["id"]: q for q in json.loads((DATA / "generated_questions.json").read_text())["questions"]}

    stat = {"official": defaultdict(lambda: [0, 0, 0.0, 0]), "generated": defaultdict(lambda: [0, 0, 0.0, 0])}
    for a in attempts:
        if a.get("mode") == "status" or not a.get("answers"):
            continue
        src = "official" if a["kind"] == "paper" else "generated"
        for i, ans in enumerate(a["answers"]):
            if src == "official":
                topic, key = tags[a["paper"]][i]["topic"], keys[a["paper"]][i]
            else:
                q = bank.get(a["qids"][i])
                if not q:
                    continue
                topic, key = q["topic"], q["answer"]
            s = stat[src][topic]
            s[0] += 1
            s[1] += int(ans == key)
            if a.get("times"):
                s[2] += a["times"][i]
                s[3] += 1

    reasons = defaultdict(lambda: defaultdict(int))
    for e in errors:
        reasons[e.get("topic")][e.get("reason") or "none"] += 1

    for src in ("official", "generated"):
        rows = sorted(stat[src].items(), key=lambda kv: (kv[1][1] / kv[1][0], -kv[1][0]))
        print(f"\n== {src} questions: accuracy by topic (weakest first)")
        for code, (n, ok, t, tn) in rows:
            avg = f"{t / tn / 60:.1f} min avg" if tn else "untimed"
            print(f"  {code}  {ok:>3}/{n:<3} {100 * ok / n:5.1f}%  {avg:>14}  {topics.get(code, code)}")
    print("\n== mistake reasons by topic")
    for code, r in sorted(reasons.items(), key=lambda kv: -sum(kv[1].values())):
        print(f"  {code}: " + ", ".join(f"{k} {v}" for k, v in sorted(r.items(), key=lambda kv: -kv[1])))

    # Weakest = lowest official accuracy among topics seen at least 3 times;
    # ties broken by more errors logged. Falls back to error counts.
    cand = [(ok / n, -sum(reasons[c].values()), c) for c, (n, ok, _, _) in stat["official"].items() if n >= 3]
    weakest = [c for _, _, c in sorted(cand)][:k]
    if len(weakest) < k:
        extra = [c for c, _ in sorted(reasons.items(), key=lambda kv: -sum(kv[1].values())) if c and c not in weakest]
        weakest += extra[: k - len(weakest)]
    print(json.dumps({"weakest": weakest, "names": [topics.get(c, c) for c in weakest]}))


if __name__ == "__main__":
    main()
