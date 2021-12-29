#!/bin/bash
set -ex
npx tsc -b
[ ! -d dist ] || rm -rf dist
[ -d etc ] || mkdir etc
npx api-extractor run --local &
npx esbuild --bundle lib/index.js --outdir=dist --minify --sourcemap --format=cjs &
wait
