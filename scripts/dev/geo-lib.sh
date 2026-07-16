#!/usr/bin/env sh

# AERIUS vue-geo-components dev helper
# Drives the local workflow for developing this library against a consuming app
# (GRIP, Archive, ...): a live rebuild-and-push loop, yalc link/unlink, and a
# freshness check against the published `dev` snapshot.
#
# Run from anywhere; the script resolves the library repo root itself. The app
# directory is passed as an argument or via the GEO_APP env var.

set -e

PACKAGE="@aerius/vue-geo-components"

# This script lives in scripts/dev/, so the repo root is two levels up.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

show_help() {
  echo "AERIUS vue-geo-components dev helper"
  echo ""
  echo "Usage: $0 <command> [app-dir]"
  echo ""
  echo "Commands:"
  echo "  watch            Rebuild on every save and push each build into linked apps."
  echo "                   This is the live loop; leave it running while you work."
  echo "  link [app-dir]   Build, publish to the yalc store, and link into the app."
  echo "  unlink [app-dir] Restore the app to its published dependency."
  echo "  check [app-dir]  Warn if the app's installed dev build is behind the dev tag."
  echo "  help             Show this help."
  echo ""
  echo "The app directory is taken from the argument or the GEO_APP env var."
  echo ""
  echo "Examples:"
  echo "  $0 link ../grip          # link this library into a sibling GRIP checkout"
  echo "  $0 watch                 # then run this and keep it open"
  echo "  GEO_APP=../grip $0 check  # is that app's snapshot stale?"
  echo "  $0 unlink ../grip        # back to the published version"
  echo ""
}

# Resolve the target app directory from $1 or $GEO_APP into an absolute path.
resolve_app() {
  APP="${1:-$GEO_APP}"
  if [ -z "$APP" ]; then
    echo "Error: no app directory given (pass it as an argument or set GEO_APP)."
    exit 1
  fi
  if [ ! -f "$APP/package.json" ]; then
    echo "Error: '$APP' is not an app checkout (no package.json found)."
    exit 1
  fi
  APP="$(cd "$APP" && pwd)"
}

cd "$PROJECT_ROOT"

COMMAND="${1:-help}"
[ $# -gt 0 ] && shift || true

case "$COMMAND" in
  watch)
    echo "Watching $PACKAGE: rebuild on save, push into linked apps. Ctrl-C to stop."
    # Push each fresh build into linked apps in the background, rebuild in the
    # foreground, and stop the pusher when the build watcher exits.
    npx nodemon --watch dist --exec "yalc push" &
    PUSH_PID=$!
    trap 'kill "$PUSH_PID" 2>/dev/null || true' EXIT INT TERM
    npm run dev
    ;;

  link)
    resolve_app "$@"
    echo "Building and publishing $PACKAGE to the yalc store..."
    npm run build-only
    yalc publish
    echo "Linking into $APP..."
    # yalc link (not add) leaves the app's package.json untouched.
    (cd "$APP" && yalc link "$PACKAGE")
    echo ""
    echo "Linked. Run '$0 watch' and keep it open to push your saves live."
    echo "Make sure '.yalc/' and 'yalc.lock' are gitignored in the app."
    ;;

  unlink)
    resolve_app "$@"
    echo "Unlinking $PACKAGE from $APP and restoring the published version..."
    (cd "$APP" && yalc remove "$PACKAGE" && npm install)
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
