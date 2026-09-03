#!/usr/bin/env python3
"""VΞRN routing diagnostic — run this on YOUR machine.

    python3 scripts/diagnose.py            # checks port 5500
    python3 scripts/diagnose.py 5510       # checks another port

It identifies WHICH server answers on the port and whether it can serve
/library/{id}/. It never modifies any file.
"""

import json
import sys
import urllib.error
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
BASE = "http://127.0.0.1:%d" % PORT


def probe(path):
    url = BASE + path
    req = urllib.request.Request(url, headers={"User-Agent": "vern-diagnose"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, dict(r.headers), r.read(20000)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read(20000)
    except Exception as e:
        return None, {}, str(e).encode()


def identify(headers, body):
    server = (headers.get("Server") or "").strip()
    powered = (headers.get("X-Powered-By") or "").strip()
    text = body.decode("utf-8", "replace")

    if server.startswith("VernDev"):
        return "scripts/dev-server.py  (LE BON SERVEUR)", True
    if "Cannot GET" in text or powered.lower().startswith("express"):
        return "Express / VS Code Live Server  (pas de reecriture)", False
    if "Not found:" in text:
        return "serveur statique Node (live-server / five-server / autre)", False
    if server.startswith("SimpleHTTP"):
        return "python -m http.server  (pas de reecriture)", False
    if server:
        return "serveur inconnu: %s %s" % (server, powered), False
    return "serveur inconnu (aucun en-tete Server)", False


def main():
    print("=" * 62)
    print("VΞRN — diagnostic de routing sur %s" % BASE)
    print("=" * 62)

    status, headers, body = probe("/library/fedora/")
    if status is None:
        print("\nAucun serveur ne repond sur le port %d." % PORT)
        print("  -> lance :  python3 scripts/dev-server.py %d" % PORT)
        sys.exit(1)

    name, is_vern = identify(headers, body)

    print("\nSERVEUR DETECTE : %s" % name)
    print("  Server        : %s" % (headers.get("Server") or "(absent)"))
    print("  X-Powered-By  : %s" % (headers.get("X-Powered-By") or "(absent)"))

    print("\nREPONSES :")
    checks = [
        ("/", None),
        ("/library/", None),
        ("/404.html", None),
        ("/data/library/fedora.json", None),
        ("/library/fedora/", "route dynamique"),
    ]
    ok_route = False
    for path, note in checks:
        st, hd, bd = probe(path)
        flag = "OK " if st == 200 else "ERR"
        print("  %s %-30s %s %s" % (flag, path, st, note or ""))
        if path == "/library/fedora/" and st == 200:
            ok_route = True
            served_shell = b"library-resource" in bd or b"library-builder" in bd
            print("      shell generique servi : %s" % served_shell)

    print("\n" + "-" * 62)
    if is_vern and ok_route:
        print("RESULTAT : OK — /library/fedora/ fonctionne.")
        print("Ouvre :  %s/library/fedora/" % BASE)
    else:
        print("RESULTAT : ECHEC — ce serveur ne sait pas servir /library/{id}/.")
        print("")
        print("Ce n'est PAS un probleme d'architecture : aucun HTML par")
        print("ressource ne doit etre cree. Ce serveur n'a simplement pas la")
        print("regle de reecriture que Cloudflare (_redirects) et GitHub")
        print("Pages (404.html) appliquent en production.")
        print("")
        print("A FAIRE :")
        print("  1. arrete le serveur qui occupe le port %d" % PORT)
        print("     (VS Code : clic sur 'Port: %d' dans la barre d'etat)" % PORT)
        print("  2. lance :  python3 scripts/dev-server.py %d" % PORT)
        print("  3. relance :  python3 scripts/diagnose.py %d" % PORT)
        sys.exit(2)


if __name__ == "__main__":
    main()
