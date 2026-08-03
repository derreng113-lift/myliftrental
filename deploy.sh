#!/usr/bin/env bash
set -e
mkdir -p dist
cp index.html dist/
cp styles.css dist/
cp app.js dist/
cp -R images dist/ 2>/dev/null || true
