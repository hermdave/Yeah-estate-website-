# TMUA Study Desk

A study dashboard for the TMUA (sitting **8 January 2027**). The student's main
weakness is **speed**: 20 questions in 75 minutes, no calculator, no negative marking.

## Where things are

| Path | What |
|---|---|
| `app/page.html`, `app/app.js` | The dashboard (one page, plain JS). Published as the artifact below; also runs locally. |
| `app/vendor/katex/` | KaTeX 0.16.11 with fonts inlined (rebuild with `tools/vendor_katex.py`). |
| `data/answer_keys.json` | Official answer keys, every answer cross-checked against the worked answers (`tools/build_answer_keys.py`). |
| `data/question_tags.json` | Topic / difficulty / technique / own-words description for all 360 official questions. |
| `data/topics.json` | Topic codes (`QUA`, `NEC`, `ERR`...) mapped to official spec sections. |
| `data/paper_links.json` | Official PDF URLs. |
| `data/generated_questions.json` | The practice bank: original questions written by Claude. |
| `data/checks/<id>.py` | The independent answer check for each generated question. |
| `papers/` | Official PDFs. **Gitignored.** Re-download with `python3 tmua/tools/fetch_papers.py`. |
| `tools/serve.py` | Local server: `python3 tmua/tools/serve.py` (add `--lan` for a phone on the same Wi-Fi). |
| `tools/stats.py` | Topic accuracy, reasons, time per topic, and the weakest topics. |
| `tools/verify_questions.py` | Validates the bank and runs every check script. |

**Artifact:** https://claude.ai/artifact/LaJx66NgtreYijYxKvoiqw (private to the owner).
Its `db` holds the student's data in two collections:
- `attempts`: one document per paper or practice set. Fields: `kind` (`paper`/`practice`), `paper`, `qids`, `mode` (`timed`/`untimed`/`status`), `answers`, `flags`, `times` (seconds per question), `score`, `usedSec`.
- `errors`: one document per wrong, blank, guessed or slow question. Fields: `src` (`official`/`generated`), `paper`, `q`, `gid`, `topic`, `why`, `reason` (`topic`/`slip`/`trick`/`time`/`misread`), `redo`.

Locally the same data lives in the browser's localStorage under `tmua.v1`.

## Hard rules

- **Never commit or publish official question text.** No quotes, paraphrases or screenshots of TMUA questions in anything tracked by git or sent to the artifact. Tags and descriptions are in our own words. Answer letters and links are fine.
- Generated questions must be **genuinely new**, not reworded past-paper questions. Use the same skills, but with a different set-up, different numbers and a different route to the answer.
- **No generated question is saved unless its answer has been verified twice** (see step 4). If the checks disagree, throw the question away. Never "fix" it by changing the stored answer to match.
- Keep generated and official questions separate. Official questions are `kind: "paper"`. Generated ones are `kind: "practice"` and use `g####` ids.

## Workflow: "generate N questions on my K weakest topics"

### 1. Read the student's data

Read the artifact's db with the ArtifactData tool, saving the documents to files:

```
ArtifactData action=list url=<artifact> collection=attempts query={limit:1000} out_dir=<scratchpad>/db
ArtifactData action=list url=<artifact> collection=errors   query={limit:1000} out_dir=<scratchpad>/db
python3 tmua/tools/stats.py <scratchpad>/db --weakest K
```

If the student gives you a backup JSON instead, run `stats.py` on that file. The last line of the output is `{"weakest": [...]}`. If the student names topics, use those instead.

If there's too little data (no topic seen at least 3 times), say so. Suggest recording a few past papers first, or ask which topics they want.

### 2. Plan the set

For each target topic, look at:
- the official questions with that topic in `question_tags.json` (techniques and difficulty spread);
- the mistake **reasons** logged against it, and design for them:
  - `trick`: questions with one key insight that collapses the work (symmetry, substitution, a sketch instead of algebra).
  - `slip`: questions where a careless step leads straight to a listed distractor.
  - `time`: questions that are fast by the smart route and slow by brute force.
  - `topic`: start at difficulty 1–2 and build up.
  - `misread`: wording that rewards careful reading ("not true", "must", "which one of the following is **not** possible").

Mix difficulties, roughly 30% at 1, 50% at 2 and 20% at 3, unless asked otherwise. Paper 2 topics (`IMP`, `NEC`, `QNT`, `CEX`, `PRF`, `DED`, `ERR`) need Paper 2 formats:
- necessary/sufficient option sets;
- a numbered "attempted proof" (lines I–V) with "the first error is on line …";
- choosing a counterexample from a list;
- negating quantified statements;
- reordering proof steps;
- "which of I, II, III must be true", with options like "I and III only".

### 3. Write each question (TMUA style)

- Non-calculator. Numbers must work out cleanly by hand.
- 5 to 8 options, labelled A, B, C, … in order (TMUA uses up to H). For Paper 2 "which of I, II, III" questions, use the standard 8 combinations: none, I only, II only, III only, I and II only, I and III only, II and III only, I, II and III.
- **Every distractor comes from a specific, plausible mistake**: sign error, forgotten ± root, dropped solution from dividing by zero, converse instead of contrapositive, off-by-one in a range, wrong quadrant, and so on. Record the mistake in `distractors`.
- Maths in KaTeX: `$...$` inline, `$$...$$` display. In JSON, backslashes must be doubled (`"$\\frac{1}{2}$"`).
- The worked solution should be short and show the fastest route. Where there is a quicker method than brute force, show it, because speed is the student's weakness.

The schema for each entry in `data/generated_questions.json`:

```json
{
  "id": "g0007", "topic": "QUA", "paper": 1, "difficulty": 2,
  "stem": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "...", "E": "...", "F": "..."},
  "answer": "D",
  "solution": "...",
  "distractors": {"A": "forgot the negative root", "B": "...", "C": "...", "E": "...", "F": "..."},
  "technique": "one line, like question_tags.json",
  "created": "YYYY-MM-DD"
}
```

Ids continue from the highest existing `g####`.

### 4. Verify, then discard anything that disagrees

For every question:

1. **Solve it a second time, independently.** Do this from the stem and options alone, without looking at the worked solution, preferably by a different method. Write the answer down.
2. **Write `data/checks/<id>.py`** with a `check()` function that computes the correct option letter. Use sympy, exact arithmetic or a brute-force search. It must:
   - evaluate **every** option and assert that **exactly one** matches;
   - return that letter.

   For logic questions, brute-force a finite domain (for example all integers −50..50 or all small polynomials) to confirm each statement's truth value, then map the pattern to the option. For "first error in this proof" questions, test each line's claimed implication on concrete values.
3. Run `python3 tmua/tools/verify_questions.py`. It checks the schema, runs every check script, and (when `papers/` exists) flags wording shared with an official paper.
4. Keep a question only if the stored answer, your second solution and the check script all agree and the verifier says OK. Otherwise delete the question **and** its check file. Don't patch the answer to fit. Count the discards and report them.

### 5. Save and publish

1. Write the surviving questions into `data/generated_questions.json` and their checks into `data/checks/`. Re-run the verifier on the whole bank; it must pass.
2. Commit and push on the working branch.
3. Update the artifact's data file. In a new conversation, first `Artifact action=read url=<artifact>`, then:
   ```
   Artifact url=<artifact> file_path=tmua/app/page.html
            files={"data/generated_questions.json": "tmua/data/generated_questions.json"}
   ```
   Leave out `capabilities` so the stored `db` rules stay, and leave out the other files so they stay as published. The student's data is in the db, so a republish never touches it.

### 6. Report

Give a short list: how many questions were added per topic and difficulty, how many were discarded and why. Remind the student that the new questions are in the **Practice** tab, where they come pre-selected for the weakest topics.

## Other maintenance

- **Re-download the papers** (new machine or new container): `python3 tmua/tools/fetch_papers.py`. This container's network policy needs `esat-tmua.ac.uk` allowed; the PDFs themselves come from `uat-wp.s3.eu-west-2.amazonaws.com`.
- **Rebuild the answer keys:** `python3 tmua/tools/build_answer_keys.py`. It exits non-zero on any disagreement with the worked answers. Hand-verified cases are in `data/key_manual_checks.json`.
- **App changes:** edit `app/page.html` / `app/app.js` and test locally with `tools/serve.py`. Then republish `tmua/app/page.html` with every changed file in `files` (`app.js`, `vendor/...`, `data/...`) at their published paths. Published paths mirror `serve.py`: the page is at the root, `app.js` is `tmua/app/app.js`, `vendor/*` is `tmua/app/vendor/*` and `data/*` is `tmua/data/*`.
