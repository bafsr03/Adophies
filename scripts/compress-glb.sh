#!/usr/bin/env bash
#
# Adophies — GLB compression pipeline
#
# Compresses every .glb in the source folder using:
#   - Draco mesh compression (typical 5-10x reduction on geometry)
#   - WebP texture compression (3-5x smaller than PNG/JPEG)
#   - Texture downscaling to 1024px (gem detail is preserved; you rarely
#     need 4K maps for jewelry that ships rendered at <800px on screen)
#
# Requires:  npm install -g @gltf-transform/cli
#
# Usage:
#   bash scripts/compress-glb.sh
#   bash scripts/compress-glb.sh /path/to/source /path/to/output
#
# Environment overrides:
#   TEX_SIZE=2048 bash scripts/compress-glb.sh    (default 1024)

set -euo pipefail

SRC="${1:-../JewelryRenders }"
DEST="${2:-../compressed-glb}"
TEX_SIZE="${TEX_SIZE:-1024}"

if ! command -v gltf-transform >/dev/null 2>&1; then
  echo "ERROR: gltf-transform CLI not found." >&2
  echo "Install it with:" >&2
  echo "    npm install -g @gltf-transform/cli" >&2
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "ERROR: source folder not found: $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"

total_before=0
total_after=0
count=0

for src in "$SRC"/*.glb; do
  [ -e "$src" ] || { echo "No .glb files in $SRC"; exit 1; }

  name=$(basename "$src")
  dest="$DEST/$name"
  before=$(stat -f%z "$src" 2>/dev/null || stat -c%s "$src")
  total_before=$((total_before + before))

  printf '\n[%2d] %s  (%s MB)\n' "$count" "$name" "$((before / 1024 / 1024))"

  gltf-transform optimize "$src" "$dest" \
    --compress draco \
    --texture-compress webp \
    --texture-size "$TEX_SIZE" \
    --simplify false

  after=$(stat -f%z "$dest" 2>/dev/null || stat -c%s "$dest")
  total_after=$((total_after + after))
  pct=$(( 100 - (after * 100 / before) ))
  printf '     -> %s MB  (-%s%%)\n' "$((after / 1024 / 1024))" "$pct"
  count=$((count + 1))
done

echo ""
echo "===================================================="
printf 'Processed %d files\n' "$count"
printf 'Total: %s MB  ->  %s MB\n' \
  "$((total_before / 1024 / 1024))" \
  "$((total_after / 1024 / 1024))"
echo "Output: $DEST"
echo ""
echo "Next steps:"
echo "  1. Upload everything in $DEST to Shopify Admin > Content > Files"
echo "  2. Copy each file's CDN URL"
echo "  3. Paste URLs into theme customizer (Jewelry 3D Teaser / Gallery sections)"
echo "===================================================="
