#!/usr/bin/env python3
"""Run the TMUA dashboard locally.

    python3 tmua/tools/serve.py            # http://localhost:8765
    python3 tmua/tools/serve.py --lan      # also reachable from your phone on the same Wi-Fi

Serves the same page that is published as the claude.ai artifact, wrapped in
the same HTML skeleton the artifact host adds. Locally, progress is kept in
the browser's localStorage (use Export/Import to move it), and the PDF
buttons open your downloaded copies in papers/.
"""
import http.server
import pathlib
import socket
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8765
HEAD = ('<!doctype html><html><head><meta charset=utf8>'
        '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}'
        'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}'
        '</style></head><body>')
ROUTES = {"data": ROOT / "data", "papers": ROOT / "papers", "vendor": ROOT / "app" / "vendor"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        top, _, rest = path.partition("/")
        if top in ROUTES:
            target = (ROUTES[top] / rest).resolve()
            if ROUTES[top].resolve() in target.parents or target == ROUTES[top].resolve():
                return str(target)
            return str(ROOT / "404")
        return str(ROOT / "app" / path)

    def do_GET(self):
        if self.path.split("?")[0] in ("/", "/index.html"):
            body = (HEAD + (ROOT / "app" / "page.html").read_text() + "</body></html>").encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    lan = "--lan" in sys.argv
    host = "0.0.0.0" if lan else "127.0.0.1"
    server = http.server.ThreadingHTTPServer((host, PORT), Handler)
    print(f"TMUA dashboard: http://localhost:{PORT}")
    if lan:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("10.255.255.255", 1))
            print(f"On your phone (same Wi-Fi): http://{s.getsockname()[0]}:{PORT}")
        except OSError:
            pass
        finally:
            s.close()
    print("Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
