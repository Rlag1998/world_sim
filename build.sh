#!/bin/sh
# Concatenate the annotated sources into the single deliverable HTML file.
set -e
cd "$(dirname "$0")"
cat src/00_head.html \
    src/10_core.js src/20_worldgen.js src/30_lang.js src/40_peoples.js \
    src/50_econ.js src/60_char.js src/65_polity.js src/70_war.js \
    src/80_myth.js src/85_sim.js src/90_render.js src/95_ui.js \
    src/99_tail.html > world_sim.html
echo "built world_sim.html ($(wc -c < world_sim.html) bytes, $(wc -l < world_sim.html) lines)"
