#!/usr/bin/env bash
set -e

# Geo library dev pane. A consuming app's frontend loads
# @aerius/vue-geo-components from node_modules. This pane rebuilds a linked local
# checkout on change (so edits reach the running app), or reports the installed
# published package.
#
# Keys: S toggles local <-> published; U (published only) updates to the latest
# published version; Q quits. Each acts via geo-lib-link.sh and restarts.
#
# Usage: geo-lib.sh <frontend-dir> [link|unlink|update|status]
#
# With a command it just forwards to geo-lib-link.sh, so an app needs to know
# about one script rather than two. This lives in the library because it was the
# same file in every app.

SCRIPT_PATH=$(readlink -f "${BASH_SOURCE:-$0}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")

FRONTEND_DIR="${1}"
if [ -z "${FRONTEND_DIR}" ] || [ ! -f "${FRONTEND_DIR}/package.json" ]; then
  echo "Usage: $0 <frontend-dir> [link|unlink|update|status]"
  echo "<frontend-dir> is the directory holding the app's package.json."
  exit 1
fi
FRONTEND_DIR=$(cd "${FRONTEND_DIR}" && pwd -P)
PKG_DIR="${FRONTEND_DIR}/node_modules/@aerius/vue-geo-components"

if [ -n "${2}" ]; then
  exec "${SCRIPT_DIR}/geo-lib-link.sh" "${FRONTEND_DIR}" "${2}"
fi

WORKER_PID=""
stop_worker() {
  if [ -n "${WORKER_PID}" ]; then
    kill "${WORKER_PID}" 2>/dev/null || true
    WORKER_PID=""
  fi
}
trap 'stop_worker; exit 0' INT TERM
trap stop_worker EXIT

echo "=================================================="
if [ -L "${PKG_DIR}" ]; then
  MODE=local
  CHECKOUT=$(readlink -f "${PKG_DIR}")
  echo "Geo lib: LOCAL   ${CHECKOUT}"
  echo "Rebuilding on change.   [S] switch to published   [Q] quit"
  echo "=================================================="
  if [ -x "${CHECKOUT}/node_modules/.bin/vite" ]; then
    (cd "${CHECKOUT}" && exec node_modules/.bin/vite build --watch) &
    WORKER_PID=$!
  else
    echo "vite not installed in the checkout; run 'npm install' there. Not rebuilding."
  fi
elif [ -d "${PKG_DIR}" ]; then
  MODE=published
  VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${PKG_DIR}/package.json" 2>/dev/null | head -1)
  echo "Geo lib: PUBLISHED   ${VERSION}"
  # From the frontend directory, so its .npmrc maps the @aerius scope to Nexus.
  LATEST=$(cd "${FRONTEND_DIR}" && npm view "@aerius/vue-geo-components@dev" version 2>/dev/null || true)
  if [ -n "${LATEST}" ] && [ "${LATEST}" != "${VERSION}" ]; then
    echo "A newer version is available: ${LATEST}"
  fi
  echo "[U] update to latest   [S] switch to a local checkout   [Q] quit"
  echo "=================================================="
else
  MODE=none
  echo "Geo lib: NOT INSTALLED"
  echo "[S] link a local checkout   [Q] quit"
  echo "=================================================="
fi

# Without a terminal (detached / non-interactive) there are no keys to read;
# stay tied to the worker if there is one, else just keep the pane alive.
if [ ! -t 0 ]; then
  [ -n "${WORKER_PID}" ] && wait "${WORKER_PID}"
  while true; do sleep 3600; done
fi

restart() {
  stop_worker
  echo
  echo ">>> ${1}"
  shift
  "${SCRIPT_DIR}/geo-lib-link.sh" "${FRONTEND_DIR}" "$@"
  echo ">>> restarting..."
  exec "${SCRIPT_PATH}" "${FRONTEND_DIR}"
}

while true; do
  IFS= read -rsn1 key || { sleep 1; continue; }
  case "${key}" in
    s | S) restart "switching geo lib mode..." ;;
    u | U)
      if [ "${MODE}" = "published" ]; then restart "updating to the latest published version..." update; fi
      ;;
    q | Q) exit 0 ;;
  esac
done
