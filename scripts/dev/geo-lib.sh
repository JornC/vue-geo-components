#!/usr/bin/env sh

# AERIUS vue-geo-components dev helper
# Drives the local workflow for developing this library against a consuming app
# (GRIP, Archive, ...): a self-managing live loop that links, rebuilds-and-pushes,
# and restores the app on exit, plus a freshness check against the `dev` snapshot.
#
# Run from anywhere; the script resolves the library repo root itself. The app
# directory is passed as an argument or via the GEO_APP env var.

set -e

PACKAGE="@aerius/vue-geo-components"

# This script lives in scripts/dev/, so the repo root is two levels up.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Set while `watch` runs, and read by cleanup() on exit.
APP=""
PUSH_PID=""
LINKED=""

show_help() {
  echo "AERIUS vue-geo-components dev helper"
  echo ""
  echo "Usage: $0 <command> [app-dir]"
  echo ""
  echo "Commands:"
  echo "  watch [app-dir]  Link the library into the app, rebuild on every save and"
  echo "                   push each build into it, then restore the app on exit."
  echo "                   One command for a whole dev session; just Ctrl-C when done."
  echo "                   With no app-dir it only watches (assumes an existing link)."
  echo "  link [app-dir]   Link the library into the app and leave it (no teardown)."
  echo "  unlink [app-dir] Restore the app to its published dependency."
  echo "  check [app-dir]  Warn if the app's installed dev build is behind the dev tag."
  echo "  help             Show this help."
  echo ""
  echo "The app directory is taken from the argument or the GEO_APP env var."
  echo ""
  echo "Examples:"
  echo "  $0 watch ../grip         # link GRIP, watch, restore on Ctrl-C (the usual case)"
  echo "  GEO_APP=../grip $0 watch  # same, via env"
  echo "  $0 check ../grip         # is that app's snapshot stale?"
  echo ""
}

# Resolve the target app directory from $1 or $GEO_APP into an absolute path.
# Errors out when it is missing (for commands that require an app).
resolve_app() {
  APP="${1:-$GEO_APP}"
  if [ -z "$APP" ]; then
    echo "Error: no app directory given (pass it as an argument or set GEO_APP)."
    exit 1
  fi
  validate_app
}

# Like resolve_app, but an empty app directory is allowed (leaves APP empty).
resolve_app_optional() {
  APP="${1:-$GEO_APP}"
  [ -z "$APP" ] && return 0
  validate_app
}

validate_app() {
  if [ ! -f "$APP/package.json" ]; then
    echo "Error: '$APP' is not an app checkout (no package.json found)."
    exit 1
  fi
  APP="$(cd "$APP" && pwd)"
}

# Link the current build into $APP. yalc link (not add) leaves the app's
# package.json untouched, so there is nothing to accidentally commit.
link_app() {
  echo "Linking $PACKAGE into $APP..."
  npm run build-only
  yalc publish
  (cd "$APP" && yalc link "$PACKAGE")
  LINKED=1
}

# Restore $APP to its published dependency.
unlink_app() {
  echo "Restoring $APP to its published version..."
  (cd "$APP" && yalc remove "$PACKAGE" && npm install)
}

# Runs on exit of `watch`: stop the pusher and, if we set up a link, tear it down.
cleanup() {
  [ -n "$PUSH_PID" ] && kill "$PUSH_PID" 2>/dev/null || true
  if [ -n "$LINKED" ]; then
    echo ""
    unlink_app || true
  fi
}

cd "$PROJECT_ROOT"

COMMAND="${1:-help}"
[ $# -gt 0 ] && shift || true

case "$COMMAND" in
  watch)
    resolve_app_optional "$@"
    # Arm cleanup before linking, so even a Ctrl-C mid-setup restores the app.
    # Turn Ctrl-C / TERM into a normal exit so the EXIT trap runs cleanup once.
    trap cleanup EXIT
    trap 'exit 130' INT TERM
    if [ -n "$APP" ]; then
      link_app
      echo "The app uses your local build until you stop this (Ctrl-C)."
    fi
    echo "Watching $PACKAGE: rebuild on save, push into linked apps. Ctrl-C to stop."
    npx nodemon --watch dist --exec "yalc push" &
    PUSH_PID=$!
    npm run dev
    ;;

  link)
    resolve_app "$@"
    link_app
    echo ""
    echo "Linked and left in place. Run '$0 watch' (no app-dir) to push saves live,"
    echo "and '$0 unlink $APP' when you want the app back on the published version."
    echo "Make sure '.yalc/' and 'yalc.lock' are gitignored in the app."
    ;;

  unlink)
    resolve_app "$@"
    unlink_app
    echo "Done."
    ;;

  check)
    resolve_app "$@"
    INSTALLED="$(cd "$APP" && node -p "require('$PACKAGE/package.json').version" 2>/dev/null || true)"
    if [ -z "$INSTALLED" ]; then
      echo "$PACKAGE is not installed in $APP; nothing to check."
      exit 0
    fi
    # Only a dev snapshot can be "behind"; a pinned release is intentional.
    case "$INSTALLED" in
      *-dev-*) ;;
      *)
        echo "$APP is on release $INSTALLED (not a dev snapshot); nothing to check."
        exit 0
        ;;
    esac
    LATEST="$(npm view "$PACKAGE@dev" version 2>/dev/null || true)"
    if [ -n "$LATEST" ] && [ "$LATEST" != "$INSTALLED" ]; then
      echo "A newer dev build is available: $LATEST (you have $INSTALLED)."
      echo "Update with: (cd \"$APP\" && npm update $PACKAGE)"
    else
      echo "Up to date ($INSTALLED)."
    fi
    ;;

  help | --help | -h)
    show_help
    ;;

  *)
    echo "Error: unknown command '$COMMAND'"
    echo ""
    show_help
    exit 1
    ;;
esac
