#!/bin/bash
set -euo pipefail

PLUGIN_NAME="decidr"
ZIP_NAME="${PLUGIN_NAME}.zip"
RELEASE_DIR="release"
BUILD_DIR=".build"

echo "Building ${ZIP_NAME}..."

# Clean previous build
rm -rf "${RELEASE_DIR}" "${BUILD_DIR}"
mkdir -p "${RELEASE_DIR}"

# Create build directory
mkdir -p "${BUILD_DIR}/renderers"

# Read version from manifest and sync download_url in both source and build
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
DOWNLOAD_URL="https://github.com/DeeJanuz/decidr-plugin/releases/download/${VERSION}/decidr.zip"

# Update source manifest so raw GitHub URL has correct download_url
python3 -c "
import json
m = json.load(open('manifest.json'))
m['download_url'] = '${DOWNLOAD_URL}'
json.dump(m, open('manifest.json', 'w'), indent=2)
print('  Updated source manifest download_url')
"

# Copy to build dir
cp manifest.json "${BUILD_DIR}/manifest.json"
echo "  Version: ${VERSION}"
echo "  Download URL: ${DOWNLOAD_URL}"

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

# Copy prompts directory
cp -r prompts "${BUILD_DIR}/prompts"

# Create ZIP in release directory
cd "${BUILD_DIR}"
zip -r "../${RELEASE_DIR}/${ZIP_NAME}" manifest.json renderers/ prompts/
cd ..

# Clean up
rm -rf "${BUILD_DIR}"

echo "Built ${RELEASE_DIR}/${ZIP_NAME} ($(du -h "${RELEASE_DIR}/${ZIP_NAME}" | cut -f1))"
