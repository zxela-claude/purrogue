#!/usr/bin/env python3
"""Generate relic/item icons for Purrogue with improved prompts."""

import os, sys, json, base64, subprocess, time

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OUTPUT_DIR = "/workspace/group/purrogue/assets/relics"

if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY not set"); sys.exit(1)

# Style: square RPG item icon, clear readable at small size
STYLE = (
    "fantasy RPG item icon, square format, centered object on dark background, "
    "vibrant jewel-like colors, rich painterly detail, glowing magical aura, "
    "professional game art, high contrast, iconic and instantly readable, "
    "no text, no UI elements, no borders, no frame"
)

RELICS = {
    "laser_toy": "a sleek red laser pointer pen glowing with a bright red beam, magical sparkles at the tip, dark background",
    "catnip": "a lush bunch of vibrant green catnip herb tied with twine, glowing with magical golden energy, aromatic shimmer",
    "hairball": "a disgusting but powerful glowing hairball radiating dark energy, purple mystical aura, gross yet magical",
    "yarn_ball": "a perfectly wound ball of magical golden yarn glowing with healing warmth, soft light radiating outward",
    "bell_collar": "an elegant cat collar with a shiny golden bell, enchanted runes on the collar band, bell glowing with power",
    "cat_nap": "a fluffy cloud pillow glowing with warm amber moonlight, ZZZ symbols floating, dreamy cozy atmosphere",
    "toy_mouse": "a small cloth toy mouse with stitched eyes radiating a blue defensive shield aura, protective glow",
    "fish_snack": "a gleaming silver fish snack treat with gold coin sparkles around it, wealth and reward energy",
    "sundial": "an ornate cat-paw sundial with glowing arcane energy lines radiating from the center, time magic",
    "cursed_collar": "a spiked black leather collar with blood-red gems pulsing with dark forbidden power, ominous glow",
    "ancient_tome": "a thick ancient spellbook bound in dark leather with a glowing cat-eye gem clasp, arcane runes floating off pages",
    "lucky_paw": "a golden lucky cat paw charm on a red string, four-leaf clover luck aura, fortune sparkles swirling",
    "coffee_mug": "a steaming mug of coffee with magical energy swirling in the steam, caffeinated lightning bolts, cozy warmth",
    "mirror": "an ornate oval hand mirror with a magical reflection that shows a second spell card, silver frame with stars",
    "claw_sharpener": "a sleek whetstone with a glowing claw being sharpened on it, sparks flying, razor-sharp edge glow",
    "warm_blanket": "a soft plaid blanket radiating warm defensive golden light, shield energy wrapped in cozy comfort",
    "magnifying_glass": "a brass magnifying glass with a glowing lens that reveals hidden details, magical analysis aura, purple light",
    "tuna_can": "a gleaming open tuna can radiating golden health energy upward, life force and vitality glow, food magic",
    "golden_ball": "a perfectly polished golden orb radiating rich amber coin-shower light, wealth and gold dripping downward",
    "nine_lives": "nine glowing ethereal spirit cats arranged in a circle around a central flame, resurrection energy, spectral light",
    "power_cell": "a glowing energy crystal cell crackling with stored electric power, blue and white electricity arcing within",
}

def generate_image(relic_id: str, description: str, attempt: int = 0) -> bool:
    prompt = f"{STYLE}, {description}"
    prompt_escaped = prompt.replace('"', '\\"').replace('\n', ' ')

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt_escaped}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
    })

    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={GEMINI_API_KEY}",
        "-H", "Content-Type: application/json",
        "-d", payload
    ], capture_output=True, text=True, timeout=60)

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"  ✗ JSON parse error for {relic_id}"); return False

    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    image_b64 = next((p["inlineData"]["data"] for p in parts if "inlineData" in p), None)

    if not image_b64:
        error = data.get("error", {})
        print(f"  ✗ No image for {relic_id}: {error.get('message', 'unknown')}")
        if attempt < 2:
            time.sleep(3)
            return generate_image(relic_id, description, attempt + 1)
        return False

    output_path = f"{OUTPUT_DIR}/{relic_id}.png"
    with open(output_path, "wb") as f:
        f.write(base64.b64decode(image_b64))
    print(f"  ✓ {relic_id}")
    return True

def main():
    relic_ids = sys.argv[1:] if len(sys.argv) > 1 else list(RELICS.keys())
    total = len(relic_ids)
    success, failed = 0, []

    for i, rid in enumerate(relic_ids, 1):
        if rid not in RELICS:
            print(f"Unknown relic: {rid}"); continue
        print(f"[{i}/{total}] Generating {rid}...")
        if generate_image(rid, RELICS[rid]):
            success += 1
        else:
            failed.append(rid)
        if i % 5 == 0 and i < total:
            time.sleep(2)

    print(f"\nDone: {success}/{total} generated")
    if failed:
        print(f"Failed: {failed}"); sys.exit(1)

if __name__ == "__main__":
    main()
