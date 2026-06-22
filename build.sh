#!/bin/bash
set -euo pipefail

PLUGIN_NAME="decidr"
ZIP_NAME="${PLUGIN_NAME}.zip"
RELEASE_DIR="release"
BUILD_DIR=".build"
BUILD_CHANNEL="${DECIDR_MCPVIEWS_BUILD_CHANNEL:-production}"

echo "Building ${ZIP_NAME}..."

# Clean previous build
rm -rf "${RELEASE_DIR}" "${BUILD_DIR}"
mkdir -p "${RELEASE_DIR}"

# Create build directory
mkdir -p "${BUILD_DIR}/renderers"

# Read version from manifest and generate a channel-specific build manifest.
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
DOWNLOAD_URL="https://github.com/DeeJanuz/decidr-plugin/releases/download/${VERSION}/decidr.zip"

BUILD_CHANNEL="${BUILD_CHANNEL}" DOWNLOAD_URL="${DOWNLOAD_URL}" python3 - <<'PY'
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

origins = {
    "production": {
        "decidr": "https://app.decidrmcp.com",
        "ludflow": "https://app.ludflow.com",
        "forbidden": [
            "https://staging.app.decidrmcp.com",
            "https://staging.app.ludflow.com",
        ],
    },
    "staging": {
        "decidr": "https://staging.app.decidrmcp.com",
        "ludflow": "https://staging.app.ludflow.com",
        "forbidden": [
            "https://app.decidrmcp.com",
            "https://app.ludflow.com",
        ],
    },
}

channel = os.environ.get("BUILD_CHANNEL", "production")
if channel not in origins:
    print(
        "DECIDR_MCPVIEWS_BUILD_CHANNEL must be 'production' or 'staging'",
        file=sys.stderr,
    )
    sys.exit(1)

selected = origins[channel]
manifest = json.load(open("manifest.json"))
manifest["download_url"] = os.environ["DOWNLOAD_URL"]
manifest.setdefault("mcp", {})
manifest["mcp"]["url"] = f"{selected['decidr']}/api/mcp"
manifest["mcp"].setdefault("auth", {})
manifest["mcp"]["auth"]["auth_url"] = f"{selected['ludflow']}/oauth/authorize"
manifest["mcp"]["auth"]["token_url"] = f"{selected['ludflow']}/oauth/token"

payload = json.dumps(manifest, indent=2)
for forbidden in selected["forbidden"]:
    if forbidden in payload:
        print(
            f"DecidR {channel} artifact contains forbidden endpoint {forbidden}",
            file=sys.stderr,
        )
        sys.exit(1)

def origin(value):
    parsed = urlparse(value or "")
    return f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""

actual = {
    "decidr": origin(manifest["mcp"]["url"]),
    "auth": origin(manifest["mcp"]["auth"]["token_url"]),
}
if actual["decidr"] != selected["decidr"] or actual["auth"] != selected["ludflow"]:
    print(
        "DecidR build channel/origin mismatch: "
        f"channel={channel}, expected_decidr={selected['decidr']}, "
        f"expected_ludflow={selected['ludflow']}, found={actual}",
        file=sys.stderr,
    )
    sys.exit(1)

Path(".build/manifest.json").write_text(payload + "\n")
print(f"  Build channel: {channel}")
print(f"  DecidR MCP: {selected['decidr']}/api/mcp")
print(f"  Ludflow auth: {selected['ludflow']}")
PY

echo "  Version: ${VERSION}"
echo "  Download URL: ${DOWNLOAD_URL}"

# Bundle shared files into each renderer
# Companion loads one renderer file per tool — shared deps must be inlined
SHARED_BUNDLE=$(cat \
  renderers/shared/00-api-client.js \
  renderers/shared/01-theme.js \
  renderers/shared/02-components.js \
  renderers/shared/03-slideouts.js)

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

bundle_renderer renderers/list.js        decidr-list.js
bundle_renderer renderers/dashboard.js  decidr-dashboard.js
bundle_renderer renderers/audit-dashboard.js decidr-audit-dashboard.js
bundle_renderer renderers/audit-reports.js decidr-audit-reports.js
bundle_renderer renderers/timeline.js   decidr-timeline.js
bundle_renderer renderers/graph.js      decidr-graph.js
bundle_renderer renderers/github-auth.js decidr-github-auth.js

# Copy prompts directory
cp -r prompts "${BUILD_DIR}/prompts"

# Create ZIP in release directory
cd "${BUILD_DIR}"
zip -r "../${RELEASE_DIR}/${ZIP_NAME}" manifest.json renderers/ prompts/
cd ..

python3 - <<'PY'
import os
import sys
import zipfile

channel = os.environ.get("DECIDR_MCPVIEWS_BUILD_CHANNEL", "production")
forbidden = {
    "production": [
        "https://staging.app.decidrmcp.com",
        "https://staging.app.ludflow.com",
    ],
    "staging": [
        "https://app.decidrmcp.com",
        "https://app.ludflow.com",
    ],
}[channel]

with zipfile.ZipFile("release/decidr.zip") as archive:
    for entry in archive.namelist():
        if entry.endswith("/"):
            continue
        data = archive.read(entry)
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        for endpoint in forbidden:
            if endpoint in text:
                print(
                    f"DecidR {channel} ZIP contains forbidden endpoint {endpoint} in {entry}",
                    file=sys.stderr,
                )
                sys.exit(1)
print(f"  Endpoint guard passed for {channel}")
PY

# Clean up
rm -rf "${BUILD_DIR}"

echo "Built ${RELEASE_DIR}/${ZIP_NAME} ($(du -h "${RELEASE_DIR}/${ZIP_NAME}" | cut -f1))"
