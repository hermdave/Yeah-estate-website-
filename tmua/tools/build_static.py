#!/usr/bin/env python3
"""Build the dashboard as plain static files (for GitHub Pages or any host).

    python3 tmua/tools/build_static.py <out-dir>

Writes index.html (the page wrapped in the same HTML skeleton serve.py uses),
app.js, vendor/ and the data JSON the app reads. It never copies papers/
(official PDFs) or data/checks/. On a static host there is no claude.ai
storage, so progress is kept in that browser's localStorage (Export/Import
moves it) and the PDF buttons open the official site.
"""
import pathlib
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from serve import HEAD  # noqa: E402  (same skeleton as the local server)

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_FILES = ["answer_keys.json", "question_tags.json", "topics.json", "paper_links.json", "generated_questions.json"]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    page = (ROOT / "app" / "page.html").read_text()
    (out / "index.html").write_text(HEAD + page + "</body></html>")
    shutil.copy(ROOT / "app" / "app.js", out / "app.js")
    shutil.copytree(ROOT / "app" / "vendor", out / "vendor", dirs_exist_ok=True)
    (out / "data").mkdir(exist_ok=True)
    for f in DATA_FILES:
        shutil.copy(ROOT / "data" / f, out / "data" / f)
    print(f"static dashboard written to {out}")


if __name__ == "__main__":
    main()
