#!/usr/bin/env python3
"""VΞRN official development server.

    python3 scripts/dev-server.py            ->  http://127.0.0.1:5500/
    python3 scripts/dev-server.py 5510       ->  custom port
    python3 scripts/dev-server.py --host 0.0.0.0

Requires nothing but a standard Python 3 install: no Node, no npm, no
Live Server, no extension.

WHY THIS SERVER EXISTS
----------------------
VΞRN is data-driven: a Library resource has NO HTML file of its own.
The route /library/{id}/ is served by one generic shell,
404.html, which then lets library-builder.js read the id from
the URL and fetch /data/library/{id}.json.

Every host VΞRN targets already provides that rewrite:

    Cloudflare Pages  ->  _redirects   (/library/:id/  ->  /404.html  200)
    GitHub Pages      ->  404.html fallback shell
    local development ->  THIS SERVER

Plain static servers (VS Code Live Server / Live Preview, `npx serve`,
`python -m http.server`) have no such rule: they look for a real directory
named library/fedora/, do not find one, and answer "Cannot GET
/library/fedora/" or "Not found: /library/fedora". That is a limitation of
those servers — never a reason to create a per-resource HTML file.
"""

import argparse
import errno
import os
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PORT = 5500
DEFAULT_HOST = "127.0.0.1"

# /library/{id} or /library/{id}/ — ids are lowercase, hyphen separated.
LIBRARY_ROUTE = re.compile(r"^/library/[a-z0-9]+(?:-[a-z0-9]+)*/?$")
RESOURCE_SHELL = os.path.join(ROOT, "404.html")

BANNER = "\u256d\u2500 V\u039eRN Dev Server"


class VernHandler(SimpleHTTPRequestHandler):
    """Static file server + the single generic Library rewrite rule."""

    server_version = "VernDev"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        # A real file always wins (/library/, /library/index.html).
        if LIBRARY_ROUTE.match(clean):
            direct = super().translate_path(clean)
            if not os.path.exists(direct):
                self.vern_rewritten = True
                return RESOURCE_SHELL
        return super().translate_path(path)

    def end_headers(self):
        # Development only: always reflect the files currently on disk.
        self.send_header("Cache-Control", "no-store")
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *args):
        msg = fmt % args
        if getattr(self, "vern_rewritten", False):
            msg += "  [rewritten -> 404.html]"
            self.vern_rewritten = False
        sys.stderr.write("  %s  %s\n" % (self.log_date_time_string(), msg))


def port_is_taken(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        target = "127.0.0.1" if host in ("0.0.0.0", "") else host
        return s.connect_ex((target, port)) == 0


def fail_port_occupied(port):
    sys.stderr.write(
        "\nV\u039eRN Dev Server cannot start:\n"
        "port %d is already occupied.\n\n"
        "Stop the other preview server and run this script again.\n\n"
        "It is most likely VS Code Live Server or Live Preview. Those servers\n"
        "cannot serve /library/{id}/ \u2014 they have no rewrite rule.\n"
        "In VS Code, click 'Port: %d' in the status bar to stop it.\n\n"
        "Or use a free port:  python3 scripts/dev-server.py 5510\n\n"
        % (port, port)
    )
    sys.exit(1)


def preflight(host, port):
    if not os.path.isfile(RESOURCE_SHELL):
        sys.exit("V\u039eRN Dev Server cannot start: missing %s" % RESOURCE_SHELL)
    if port_is_taken(host, port):
        fail_port_occupied(port)


def main():
    parser = argparse.ArgumentParser(add_help=True, description="VΞRN dev server")
    parser.add_argument("port", nargs="?", type=int, default=DEFAULT_PORT)
    parser.add_argument("--host", default=DEFAULT_HOST)
    args = parser.parse_args()

    os.chdir(ROOT)
    preflight(args.host, args.port)

    shown = "127.0.0.1" if args.host in ("0.0.0.0", "") else args.host
    url = "http://%s:%d/" % (shown, args.port)

    try:
        server = ThreadingHTTPServer((args.host, args.port), VernHandler)
    except OSError as e:
        if e.errno in (errno.EADDRINUSE, errno.EACCES):
            fail_port_occupied(args.port)
        raise

    print(BANNER)
    print("\u2502")
    print("\u2502  %s" % url)
    print("\u2502  %slibrary/fedora/" % url)
    print("\u2502")
    print("\u2502  root   : %s" % ROOT)
    print("\u2502  route  : /library/{id}/  \u2192  404.html  (200)")
    print("\u2502  stop   : Ctrl+C")
    print("\u2570\u2500 serving\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nV\u039eRN Dev Server stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
