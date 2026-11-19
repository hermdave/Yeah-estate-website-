#!/usr/bin/env python3
"""Vendor KaTeX into app/vendor/katex with its fonts inlined as data URIs,
so maths renders inside the claude.ai artifact (whose CSP blocks font files
from CDNs) and offline locally.

Usage: npm pack katex@0.16.11 && tar xzf katex-0.16.11.tgz
       python3 tmua/tools/vendor_katex.py path/to/package
"""
import base64, pathlib, re, shutil, sys

pkg = pathlib.Path(sys.argv[1]) / "dist"
out = pathlib.Path(__file__).resolve().parent.parent / "app" / "vendor" / "katex"
out.mkdir(parents=True, exist_ok=True)
css = (pkg / "katex.min.css").read_text()

def inline(m):
    name = m.group(1)
    data = base64.b64encode((pkg / "fonts" / f"{name}.woff2").read_bytes()).decode()
    return f"src:url(data:font/woff2;base64,{data}) format(\"woff2\")"

css = re.sub(r"src:url\(fonts/([\w-]+)\.woff2\) format\(\"woff2\"\)(?:,url\([^)]*\) format\(\"[^\"]*\"\))*", inline, css)
assert "fonts/" not in css, "unexpected font reference left"
(out / "katex.css").write_text(css)
shutil.copy(pkg / "katex.min.js", out / "katex.min.js")
shutil.copy(pkg / "contrib" / "auto-render.min.js", out / "auto-render.min.js")
shutil.copy(pkg.parent / "LICENSE", out / "LICENSE")
print("vendored to", out)
