#!/usr/bin/env python3
"""Download the official TMUA past papers, answer keys, worked answers,
content specification and Notes on Logic and Proof into tmua/papers/.

The papers folder is gitignored: these PDFs are for personal study only.

Usage (from anywhere):  python3 tmua/tools/fetch_papers.py
Re-running skips files that are already downloaded.
"""
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "papers"
PAGE = "https://esat-tmua.ac.uk/tmua-preparation-materials/"
UA = {"User-Agent": "Mozilla/5.0 (tmua-study-tool)"}

# Not linked from the preparation page; found via the TMUA test page and the
# site's media library. The spec linked from the TMUA test page is the first one.
EXTRAS = {
    "TMUA_Content_Specification.pdf":
        "https://uat-wp.s3.eu-west-2.amazonaws.com/wp-content/uploads/2024/05/03165619/TMUA_Content_Specification.pdf",
    "TMUA_Content_Specification_April2025.pdf":
        "https://uat-wp.s3.eu-west-2.amazonaws.com/wp-content/uploads/2025/04/30103002/TMUA_Content_Specification_April2025.pdf",
    "Notes_on_Logic_and_Proof.pdf":
        "https://uat-wp.s3.eu-west-2.amazonaws.com/wp-content/uploads/2025/06/25160507/Notes_on_Logic_and_Proof_June2025.pdf",
}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def main():
    OUT.mkdir(exist_ok=True)
    html = get(PAGE).decode("utf-8", "replace")
    links = sorted(set(re.findall(r'href="([^"]+?\.pdf)"', html)))
    files = {u.rsplit("/", 1)[1]: u for u in links if "TMUA-" in u}
    files.update(EXTRAS)
    manifest = {}
    for name, url in sorted(files.items()):
        dest = OUT / name
        if not dest.exists() or dest.stat().st_size == 0:
            data = get(url)
            if not data.startswith(b"%PDF"):
                print(f"!! {name}: not a PDF, skipped", file=sys.stderr)
                continue
            dest.write_bytes(data)
            print(f"downloaded {name} ({len(data)//1024} KB)")
        manifest[name] = url
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"{len(manifest)} files in {OUT}")


if __name__ == "__main__":
    main()
