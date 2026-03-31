#!/bin/bash
set -euo pipefail

PLUGIN_NAME="decidr"
ZIP_NAME="${PLUGIN_NAME}-plugin.zip"
BUILD_DIR=".build"

echo "Building ${ZIP_NAME}..."

# Clean previous build
rm -f "${ZIP_NAME}"
rm -rf "${BUILD_DIR}"

# Create build directory
mkdir -p "${BUILD_DIR}/renderers"

# Copy manifest
cp manifest.json "${BUILD_DIR}/"

# Bundle shared files into each renderer
# Companion loads one renderer file per tool — shared deps must be inlined
SHARED_BUNDLE=$(cat \
  renderers/shared/00-api-client.js \
  renderers/shared/01-theme.js \
  renderers/shared/02-components.js)

# Companion resolves renderer name (underscores) to filename (hyphens)
# e.g. decidr_list -> decidr-list.js
bundle_renderer() {
  local src="$1" outname="$2"
  {
    echo "/* === Bundled shared dependencies === */"
    echo "$SHARED_BUNDLE"
    echo ""
    echo "/* === Renderer: ${outname} === */"
    cat "$src"
  } > "${BUILD_DIR}/renderers/${outname}"
}

bundle_renderer renderers/list.js      decidr-list.js
bundle_renderer renderers/dashboard.js decidr-dashboard.js
bundle_renderer renderers/graph.js     decidr-graph.js

# Create ZIP from build directory
cd "${BUILD_DIR}"
zip -r "../${ZIP_NAME}" manifest.json renderers/
cd ..

# Clean up
rm -rf "${BUILD_DIR}"

echo "Built ${ZIP_NAME} ($(du -h "${ZIP_NAME}" | cut -f1))"
