#!/bin/bash
# Usage: gen_tilesheet.sh <output_path> <prompt>
# Generates a tilesheet image via Gemini API and saves to output_path

set -e
OUTPUT="$1"
PROMPT="$2"

if [ -z "$GEMINI_API_KEY" ]; then
  echo "ERROR: GEMINI_API_KEY not set"; exit 1
fi

echo "[GEN] Generating: $OUTPUT"

RESPONSE=$(curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"contents\": [{\"parts\": [{\"text\": $(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}]}],
    \"generationConfig\": {\"responseModalities\": [\"TEXT\", \"IMAGE\"]}
  }")

IMAGE_B64=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
for part in parts:
    if 'inlineData' in part:
        print(part['inlineData']['data'])
        break
" 2>/dev/null)

if [ -z "$IMAGE_B64" ]; then
  echo "ERROR: No image for $OUTPUT"
  echo "Response: $RESPONSE" | head -c 500
  exit 1
fi

echo "$IMAGE_B64" | base64 -d > "$OUTPUT"
echo "[OK] Saved: $OUTPUT ($(wc -c < "$OUTPUT") bytes)"
