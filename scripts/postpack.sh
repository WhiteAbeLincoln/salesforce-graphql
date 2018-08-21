#!/bin/sh

# Cleans up emitted build files and directories

awk '{gsub("'"$PWD/build"'", "'"$PWD"'"); printf("%s%c", $0, 0)}' ./*.emit | xargs -0 rm

# remove empty directories
find . -type d -empty -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "src/*" -delete

rm ./*.emit
