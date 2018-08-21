#!/bin/sh

while [ $# -gt 0 ]; do
  case $1 in
    -E)
      shift;
      GIT_PARAMS="$(eval echo \"'$'$1\")"
    ;;
  esac
  shift
done

FILE="${1:-.commit-msg}"

fullpath() {
  if command -v realpath >/dev/null 2>&1; then
    realpath "$@"
  elif command -v python >/dev/null 2>&1; then
    python -c "import os,sys; print os.path.realpath(sys.argv[1])" "$@"
  else
    echo >&2 "Cannot resolve $*; Aborting"
    exit 1
  fi
}

TEMPLATE="$(fullpath "$FILE")"

if [ ! -f "$TEMPLATE" ]; then
  echo >&2 "Could not find template file at $TEMPLATE"
  exit 1
fi

shift $#
set -- $GIT_PARAMS

# only apply custom messages when run as a standalone `git commit`
# ignore `--ammend` commits, merges, or commits with `-m`
if [ $# -gt 1 ]; then
  # GIT_PARAMS had more than one arg
  exit 0
fi

# if no params are present then the npm script is being run
# directly, and not via a hook
if [ -z "$1" ]; then
  cat "$TEMPLATE"
  exit 0
fi

TARGET="$(fullpath "$1")"
TEMP="$(mktemp commitXXX)"
cat "$TEMPLATE" "$TARGET" >> "$TEMP"
mv "$TEMP" "$TARGET"
