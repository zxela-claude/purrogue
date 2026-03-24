#!/usr/bin/env python3
"""Generate card art for Purrogue using Gemini image API with improved prompts."""

import os
import sys
import json
import base64
import subprocess
import time

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OUTPUT_DIR = "/workspace/group/purrogue/assets/cards"

if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY not set")
    sys.exit(1)

# Style prefix applied to every card
STYLE = (
    "fantasy card game illustration, wide landscape composition, "
    "rich painterly style, vibrant saturated colors, dramatic cinematic lighting, "
    "anthropomorphic cat warrior/mage/rogue character, highly detailed, "
    "professional TCG art, dark fantasy atmosphere, "
    "no text, no UI elements, no borders"
)

CARDS = {
    # ─── WARRIOR ────────────────────────────────────────────────────────────────
    "w_strike": "armored tabby cat warrior delivering a powerful downward sword strike, sparks flying, motion blur on the blade, golden lighting from above",
    "w_defend": "stoic gray cat knight raising a massive glowing shield, magical energy rippling outward in rings, blue and silver light",
    "w_bash": "burly orange cat slamming an iron gauntlet forward, shockwave of force radiating out, ground cracking beneath, dust cloud",
    "w_cleave": "fierce warrior cat mid-swing with a broad battle axe, wide arc energy trail glowing orange, battle-worn armor",
    "w_armored": "black cat with metallic fur bristling with defensive energy, glowing iron armor plates fusing to its body, green light veins",
    "w_headbutt": "stocky calico cat charging headfirst like a battering ram, impact stars and shockwave, battle helmet, comedic but fierce",
    "w_rage": "snarling red-eyed warrior cat engulfed in crimson energy flames, fur standing on end, veins of fire across body",
    "w_pummel": "tabby cat throwing a rapid flurry of punches, multiple ghosted paw positions showing speed, impact sparks",
    "w_entrench": "armored cat digging into defensive position, stone wall rising from earth around it, glowing earth magic, fortress atmosphere",
    "w_sword_boomerang": "orange cat swiping enormous glowing claws leaving four parallel energy cuts that glow in the dark",
    "w_war_cry": "warrior cat mid-roar with mouth wide open, sound waves visible as golden rings emanating outward, rally energy",
    "w_shield_bash": "golden-furred cat striking with an oversized magical paw wreathed in blue force energy",
    "w_flex": "muscular warrior cat flexing dramatically, energy crackling around bulging muscles, confident grin",
    "w_double_tap": "athletic cat mid-air doing two consecutive pounces shown as overlapping action frames, dynamic diagonal composition",
    "w_infernal_blade": "feral cat slashing with a claw trailing living fire, orange and red flame ribbons in the wake",
    "w_spot_weakness": "cunning cat with glowing analytical eyes studying a target, red highlight beams pointing to weak spots, detective-like pose",
    "w_bloodletting": "warrior cat drawing dark power from self-inflicted wounds, shadowy crimson energy swirling upward from claws",
    "w_immovable": "massive stone-armored cat with granite paw gauntlets, immovable as a boulder, earth runes glowing",
    "w_true_grit": "battle-scarred cat with nine ethereal ghost-cat spirits hovering protectively behind it, each glowing a different color",
    "w_limit_break": "cat unleashing maximum power, entire body radiating blinding golden energy, reality cracking around it, epic climax pose",

    # ─── MAGE ───────────────────────────────────────────────────────────────────
    "m_zap": "white-furred mage cat shooting a crackling lightning bolt from an outstretched paw, purple and white electricity arcing",
    "m_frost": "elegant cat with an ice-crystal paw creating a swirling frozen barrier, blue-white crystalline frost spreading outward",
    "m_fireball": "ginger cat coughing up a spectacular blazing fireball, tongue out, surprised expression, bright orange flames",
    "m_arcane": "cat purring contentedly with arcane purple energy swirling out and forming into glowing card shapes, magical library background",
    "m_poison_claw": "sleek cat with claws dripping luminescent green venom, toxic aura bubbling around paw, sickly green mist",
    "m_ice_barrier": "cat encased in a beautiful crystalline ice dome shield, hexagonal ice facets gleaming, blue glow from within",
    "m_thunder": "cat mid-yowl as massive thunderbolts rain down from storm clouds, lightning illuminating everything, dramatic storm scene",
    "m_mana_burn": "cat absorbing swirling blue magical energy through its body, burning it as fuel, eyes glowing electric blue",
    "m_blizzard": "cat conjuring a raging blizzard, ice shards and snow swirling, frozen landscape forming around it",
    "m_study": "bookish cat reading a large glowing magical tome by candlelight, dust motes and knowledge runes floating around",
    "m_corruption": "dark-furred cat releasing a billowing cloud of poisonous purple-black smoke from an uncorked vial, ominous atmosphere",
    "m_dual_cast": "mage cat with both paws raised simultaneously casting two completely different colored spells, split-toned dramatic lighting",
    "m_reflex": "nimble cat catching a fast-moving spell projectile out of the air with lightning-quick reflexes, time-freeze moment",
    "m_meteor": "enormous flaming meteor with glowing cat-claw scratch marks across its surface streaking down from a star-filled sky",
    "m_echo": "cat surrounded by three ghostly echo-copies of itself all casting the same spell simultaneously, overlapping magical effects",
    "m_slow": "mage cat pointing imperiously at enemies caught in a slow-time blue bubble, crystalized motion around them",
    "m_adrenaline": "wide-eyed cat absolutely vibrating with catnip-fueled magical energy, glowing green aura, manic energy, streaking speed lines",
    "m_burn_wave": "cat sending a massive rolling wave of pure golden fire spreading outward, beach-of-flame landscape",
    "m_barrier": "cat surrounded by a beautiful mandala of floating arcane shield hexagons arranged in a glowing defensive formation",
    "m_static": "cat with fur entirely standing on end from static electricity, sparks everywhere, eyes wide, comedic chaos",

    # ─── ROGUE ──────────────────────────────────────────────────────────────────
    "r_shiv": "shadowy rogue cat flicking a tiny glinting blade with two fingers, precision strike, dramatic low-angle spotlight",
    "r_dodge": "black cat blurring sideways out of the path of a sword, shadow afterimage left behind, motion lines",
    "r_backstab": "hooded cat emerging from ink-black shadows behind an enemy, dagger raised, glowing green eyes in the darkness",
    "r_poison_dart": "stealthy cat aiming a blowgun with one eye closed, tiny poison dart with trailing green mist mid-flight",
    "r_sprint": "sleek cat blurring with explosive speed, pawprint speed trails behind it, wind lines, forest or alley background",
    "r_blade_dance": "acrobatic cat spinning through the air with multiple blades whirling around it, elegant and deadly, spiral motion",
    "r_caltrops": "cunning rogue cat scattering sharp metal spikes onto the ground, toxic green tips gleaming, trap-setting pose",
    "r_predator": "panther-like rogue cat stalking silently through deep shadows toward prey, eyes glowing an intense green, pure menace",
    "r_acrobatics": "cat doing a spectacular backflip over a hazard, graceful arc, trailing ribbon of motion blur",
    "r_calculated_gamble": "tuxedo cat with a sly grin flipping a gold coin over a spread of playing cards on a velvet table, casino atmosphere",
    "r_flechettes": "cat hurling a fan of five throwing stars simultaneously, stars spreading in a perfect arc, pinpoint precision",
    "r_masterful_stab": "cat delivering one perfect decisive blade strike, laser focus, a single line of glowing cut through the air",
    "r_concentrate": "rogue cat in deep meditation-like focus, eyes narrowed to slits, energy visibly condensing into a point between paws",
    "r_noxious_fumes": "alchemist rogue cat releasing a swirling cloud of sickly toxic green-yellow mist from a shattered flask",
    "r_sucker_punch": "cat delivering a surprise paw strike from an unexpected low angle, opponent caught completely off guard, impact burst",
    "r_infiltrate": "sleek black cat flowing through shadows past unaware guards, completely invisible in the darkness, only eyes visible",
    "r_terror": "cat in full Halloween-arch hiss pose, fur fully bristled, intimidation energy radiating, enemies recoiling, eerie green aura",
    "r_bullet_time": "cat in stylized bullet-time slow-motion dodge, projectiles frozen in mid-air around it, matrix-like scene",
    "r_storm_of_steel": "cat at the center of a cyclone of slashing claws, dozens of claw-strike trails spreading in all directions",
    "r_wraith_form": "translucent spectral ghost-cat drifting through solid walls, ethereal poison-green trail, half visible half not",
}

def generate_image(card_id: str, description: str, attempt: int = 0) -> bool:
    prompt = f"{STYLE}, {description}"
    # Escape for JSON
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
        print(f"  ✗ JSON parse error for {card_id}")
        return False

    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    image_b64 = None
    for part in parts:
        if "inlineData" in part:
            image_b64 = part["inlineData"]["data"]
            break

    if not image_b64:
        error = data.get("error", {})
        print(f"  ✗ No image for {card_id}: {error.get('message', 'unknown error')}")
        if attempt < 2:
            time.sleep(3)
            return generate_image(card_id, description, attempt + 1)
        return False

    output_path = f"{OUTPUT_DIR}/{card_id}.png"
    img_bytes = base64.b64decode(image_b64)
    with open(output_path, "wb") as f:
        f.write(img_bytes)
    print(f"  ✓ {card_id} ({len(img_bytes)//1024}KB)")
    return True


def main():
    card_ids = sys.argv[1:] if len(sys.argv) > 1 else list(CARDS.keys())

    total = len(card_ids)
    success = 0
    failed = []

    for i, card_id in enumerate(card_ids, 1):
        if card_id not in CARDS:
            print(f"Unknown card: {card_id}")
            continue
        description = CARDS[card_id]
        print(f"[{i}/{total}] Generating {card_id}...")
        ok = generate_image(card_id, description)
        if ok:
            success += 1
        else:
            failed.append(card_id)
        # Small rate limit pause every 5 cards
        if i % 5 == 0 and i < total:
            time.sleep(2)

    print(f"\nDone: {success}/{total} generated")
    if failed:
        print(f"Failed: {failed}")
        sys.exit(1)


if __name__ == "__main__":
    main()
