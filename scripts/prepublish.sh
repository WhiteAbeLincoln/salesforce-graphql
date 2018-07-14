#!/bin/sh

cp .npmignore tsconfig.json LICENSE package.json package-lock.json build/

# if we had es6 builds here, we would recursively rename our build/module/**.js
# files to .mjs and move to build dir 
