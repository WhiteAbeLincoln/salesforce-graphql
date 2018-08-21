#!/bin/sh

# writes the names of the tsc emitted files to a file or stdout

OUTFILE="${1:-/dev/stdout}"

while read -r line; do
  case "$line" in
    TSFILE:*)
      echo "$line" | cut -d' ' -f 2- - >> "$OUTFILE"
      ;;
    *)
      echo "$line"
  esac
done
