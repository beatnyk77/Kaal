#!/usr/bin/env bash
# Clone beatnyk77 vendor repos for panchangJS + jyotish-api integration.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/vendor"

clone_if_missing() {
  local url="$1"
  local dest="$2"
  if [ -d "$dest/.git" ]; then
    echo "✓ $(basename "$dest") already present"
  else
    echo "Cloning $url → $dest"
    git clone --depth 1 "$url" "$dest"
  fi
}

clone_if_missing "https://github.com/beatnyk77/panchangJS.git" "$ROOT/vendor/panchangJS"
clone_if_missing "https://github.com/beatnyk77/jyotish-api.git" "$ROOT/vendor/jyotish-api"

# Kaal patch: drop Angular decorator so panchangJS runs in Vite/Vitest without @angular/core
PANCHANG_CALC="$ROOT/vendor/panchangJS/src/calculator.service.ts"
if [ -f "$PANCHANG_CALC" ] && grep -q "@angular/core" "$PANCHANG_CALC"; then
  perl -i -0pe 's/import \{ Injectable \} from .@angular\/core.;\s*@Injectable\(\{[^}]*\}\)\s*//s' "$PANCHANG_CALC"
  if ! grep -q '@ts-nocheck' "$PANCHANG_CALC"; then
    { echo '// @ts-nocheck — vendored beatnyk77/panchangJS; Kaal standalone patch'; cat "$PANCHANG_CALC"; } > "$PANCHANG_CALC.tmp"
    mv "$PANCHANG_CALC.tmp" "$PANCHANG_CALC"
  fi
  echo "✓ Applied panchangJS standalone patch"
fi

# Kaal patch: jyotish-api Docker image needs PHP 8.2 (twig ^3.11 requires >=8.1)
JYOTISH_DOCKERFILE="$ROOT/vendor/jyotish-api/api/Dockerfile"
if [ -f "$JYOTISH_DOCKERFILE" ] && grep -q 'php7.4-fpm' "$JYOTISH_DOCKERFILE"; then
  sed -i '' \
    -e 's/php7\.4/php8.2/g' \
    -e 's/php\/7\.4/php\/8.2/g' \
    "$JYOTISH_DOCKERFILE"
  echo "✓ Applied jyotish-api PHP 8.2 Docker patch"
fi

JYOTISH_COMPOSER="$ROOT/vendor/jyotish-api/api/composer.json"
if [ -f "$JYOTISH_COMPOSER" ] && grep -q '"php": ">=7.2.5"' "$JYOTISH_COMPOSER"; then
  perl -i -pe 's/"php": ">=7\.2\.5"/"php": ">=8.1"/' "$JYOTISH_COMPOSER"
  echo "✓ Applied jyotish-api composer PHP constraint patch"
fi

echo "Vendor setup complete."