#!/bin/sh
# VΞRN — official local development launcher.
#
#   ./scripts/start-dev.sh          -> http://127.0.0.1:5500/
#   ./scripts/start-dev.sh 5510     -> custom port
#
# Do NOT use VS Code Live Server / Live Preview for VΞRN: those servers
# cannot serve /library/{id}/, which is a rewritten route, not a real file.

set -eu

PORT="${1:-5500}"
DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# Locate a Python 3 interpreter.
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v py >/dev/null 2>&1; then
    PY="py -3"
elif command -v python >/dev/null 2>&1; then
    PY=python
else
    echo "VΞRN Dev Server cannot start:"
    echo "Python 3 was not found in PATH."
    echo ""
    echo "Install Python 3, then run this script again."
    exit 1
fi

# Refuse to start if the port is busy — never kill the other process.
if $PY - "$PORT" <<'EOF'
import socket, sys
port = int(sys.argv[1])
s = socket.socket()
s.settimeout(0.5)
sys.exit(0 if s.connect_ex(("127.0.0.1", port)) == 0 else 1)
EOF
then
    echo "VΞRN Dev Server cannot start:"
    echo "port $PORT is already occupied."
    echo ""
    echo "Stop the other preview server and run this script again."
    echo ""
    echo "It is most likely VS Code Live Server or Live Preview, which"
    echo "cannot serve /library/{id}/. In VS Code, click 'Port: $PORT'"
    echo "in the status bar to stop it."
    echo ""
    echo "Or use a free port:  ./scripts/start-dev.sh 5510"
    exit 1
fi

exec $PY "$DIR/scripts/dev-server.py" "$PORT"
