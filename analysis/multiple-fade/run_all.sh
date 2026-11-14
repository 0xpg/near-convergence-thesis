#!/bin/sh
set -e
B=$(cd "$(dirname "$0")" && pwd)
PY=${PYTHON:-python3}
"$PY" -I "$B/scripts/fetch.py" "$B/raw"
"$PY" -I "$B/scripts/build_panel.py" "$B/raw" "$B/out"
"$PY" -I "$B/scripts/analysis.py" "$B/out"
"$PY" -I "$B/scripts/recommend.py" "$B/out" "$B/results.json"
