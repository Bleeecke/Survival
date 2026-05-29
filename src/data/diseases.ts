// Disease durations in real-time ms (untreated)
export const DISEASE_DURATION = {
  cold:      10 * 60_000,  // 10 real min
  fever:     15 * 60_000,  // 15 real min
  parasites: 20 * 60_000,  // 20 real min
  poison:     3 * 60_000,  //  3 real min (unchanged)
};

// Health / thirst / hunger drain per game-tick (100ms) while sick
export const DISEASE_DRAIN = {
  cold:      { health: 0.004, thirst: 0.002 },   // sniffling, mild drain
  fever:     { health: 0.010, thirst: 0.006 },   // sweating, fast thirst
  parasites: { health: 0.006, hunger: 0.005 },   // gut pain, food not absorbed
  poison:    { health: 0.025 },                   // existing value kept
};

// How long player must be in rain/cold before catching a cold (ticks)
export const COLD_EXPOSURE_THRESHOLD = 3000; // 300s = 5 real min in rain

// Chance per tick of catching fever if cold is active and untreated (very low)
export const FEVER_FROM_COLD_CHANCE = 0.000_05; // ~0.03% per tick → avg ~30 real min

// Chance per tick of getting parasites from eating raw meat
export const PARASITE_CHANCE_RAW_MEAT = 0.35; // 35% per raw meat consumption

// ── Injury drains ─────────────────────────────────────────────────
export const INJURY_DRAIN = {
  bleeding: { health: 0.018 },  // ~108 HP/day — dangerous, treat fast
  wounded:  { health: 0.004, stamina: 0.3 }, // cut: slow drain + stamina penalty
};

// Chance boar attack causes bleeding (on top of direct HP dmg)
export const BLEED_ON_BOAR_ATTACK = 0.40; // 40%
// Chance knapping failure causes a cut
export const CUT_ON_KNAP_FAIL = 0.30;     // 30%
// Duration of injuries (real ms)
export const BLEED_DURATION  = 8 * 60_000;  //  8 min real
export const WOUND_DURATION  = 15 * 60_000; // 15 min real
