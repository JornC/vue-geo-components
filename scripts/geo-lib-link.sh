#!/usr/bin/env sh
set -e

# Choose how a consuming app loads @aerius/vue-geo-components. The library is
# resolved only through node_modules; this script sets which one is there:
#
#   local      node_modules/@aerius/vue-geo-components is a symlink to a local
#              checkout, so edits there (rebuilt by geo-lib.sh) reach the app.
#   published  the package installed from Nexus (the latest `dev` build).
#
# Usage:
#   geo-lib-link.sh <frontend-dir>          toggle between local and published
#   geo-lib-link.sh <frontend-dir> link     use the local checkout
#   geo-lib-link.sh <frontend-dir> unlink   use the published package
#   geo-lib-link.sh <frontend-dir> update   fetch the latest published version
#   geo-lib-link.sh <frontend-dir> status   print the current mode
#
# This lives in the library rather than in each app because every app needs the
# same thing; the app passes its own frontend directory and nothing else.

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
PUBLISHED_SPEC="@aerius/vue-geo-components@dev"

# $VUE_GEO_COMPONENTS_DIR, else this script's own checkout - which is where it
# already is in local mode, because node_modules points at it - else a
# "vue-geo-components" beside the app's repository.
find_checkout() {
  if [ -n "${VUE_GEO_COMPONENTS_DIR}" ]; then
    echo "${VUE_GEO_COMPONENTS_DIR}"
    return
  fi
  if [ -f "${SCRIPT_DIR}/../src/index.ts" ]; then
    (cd "${SCRIPT_DIR}/.." && pwd -P)
    return
  fi
  for candidate in "${FRONTEND_DIR}/../../../vue-geo-components" \
    "${FRONTEND_DIR}/../../../../vue-geo-components"; do
    if [ -f "${candidate}/src/index.ts" ]; then
      (cd "${candidate}" && pwd -P)
      return
    fi
  done
}

is_linked() {
  [ -L "${PKG_DIR}" ]
}

do_link() {
  checkout=$(find_checkout)
  if [ -z "${checkout}" ] || [ ! -f "${checkout}/package.json" ]; then
    echo "No vue-geo-components checkout found."
    echo "Set VUE_GEO_COMPONENTS_DIR to its path."
    exit 1
  fi
  checkout=$(readlink -f "${checkout}")
  mkdir -p "$(dirname "${PKG_DIR}")"
  rm -rf "${PKG_DIR}"
  ln -sfn "${checkout}" "${PKG_DIR}"
  echo "local: @aerius/vue-geo-components -> ${checkout}"
  echo "Run the Geo lib pane (or the dev stack) to rebuild it on change."
}

# --no-save keeps the "dev" tag in package.json (npm would otherwise rewrite it
# to the resolved version) and leaves the lockfile alone; only node_modules changes.
do_unlink() {
  rm -rf "${PKG_DIR}"
  echo "Installing the published package (${PUBLISHED_SPEC})..."
  (cd "${FRONTEND_DIR}" && npm install "${PUBLISHED_SPEC}" --no-save)
  echo "published: installed"
}

do_update() {
  echo "Fetching the latest published version (${PUBLISHED_SPEC})..."
  (cd "${FRONTEND_DIR}" && npm install "${PUBLISHED_SPEC}" --no-save)
  echo "published: updated"
}

do_status() {
  if is_linked; then
    echo "local: @aerius/vue-geo-components -> $(readlink -f "${PKG_DIR}")"
  elif [ -d "${PKG_DIR}" ]; then
    echo "published: installed package"
  else
    echo "not installed"
  fi
}

case "${2:-toggle}" in
  link) do_link ;;
  unlink) do_unlink ;;
  update) do_update ;;
  status) do_status ;;
  toggle) if is_linked; then do_unlink; else do_link; fi ;;
  *)
    echo "Usage: $0 <frontend-dir> [link|unlink|update|status]"
    exit 1
    ;;
esac
