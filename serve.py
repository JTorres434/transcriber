"""
Tiny launcher for Transcriber.
Starts a local HTTP server in this folder and opens the app in your browser.

Why a server? Browsers block module imports and Web Workers when a page is
opened via file://. Serving over http://localhost lets the app work normally.

Uses only the Python standard library — no installs needed.
"""

import http.server
import socketserver
import socket
import threading
import webbrowser
import sys
from pathlib import Path

ROOT = Path(__file__).parent.resolve()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        # Quieter console
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self):
        # Allow the page to load the model from the CDN without CORS issues.
        self.send_header("Access-Control-Allow-Origin", "*")
        # Don't cache index.html / worker.js so user updates always apply.
        if self.path.endswith((".html", ".js")):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


def find_free_port(preferred=8000):
    for p in [preferred, 8080, 8765, 9000, 0]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return s.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("No free port available")


def main():
    port = find_free_port(8000)
    url = f"http://localhost:{port}/index.html"

    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        print("=" * 50)
        print("  Transcriber is running.")
        print(f"  Open: {url}")
        print("  Press Ctrl+C in this window to stop.")
        print("=" * 50)
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down…")


if __name__ == "__main__":
    main()
