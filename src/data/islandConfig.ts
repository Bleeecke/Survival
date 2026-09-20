import type { IslandSettings } from '../types/generation';

/** Defaults only affect newly created islands. Existing saves carry their own resolved settings. */
export const ISLAND_DEFAULTS: Readonly<IslandSettings> = Object.freeze({
  landFraction: 0.58,        // Target before removal of disconnected land fragments.
  coastRoughness: 0.35,      // 0 = calm contour, 1 = more small bays and headlands.
  beachWidth: 4,            // Coastal distance in tiles (not a fraction of the height range).
  terrainRoughness: 0.42,    // Fine detail of the height field.
  plateauSize: 8,           // Smoothing diameter in tiles; larger values give broader terrain forms.
  plateauFraction: 0.30,    // Share of inland tiles assigned to tier 2.
  mountainFraction: 0.18,   // Share of inland tiles assigned to tiers 3 and 4.
  vegetationDensity: 0.8,   // Multiplier for plants/trees, excluding guaranteed starter resources.
  rampSpacing: 12,          // More frequent passages; connectivity repair can add closer ramps.
  mountainRidges: 2,
  ridgeStrength: 0.32,
  ridgeWidth: 18,           // Width in the internal 257 x 257 height field.
  moistureScale: 30,        // Larger values give larger coherent vegetation zones.
  rockScale: 24,
  debugOreBlock: false,
});

export const ISLAND_PRESETS = {
  balanced: ISLAND_DEFAULTS,
  gentle: { ...ISLAND_DEFAULTS, coastRoughness: 0.18, terrainRoughness: 0.25, plateauSize: 14, mountainFraction: 0.10, beachWidth: 6 },
  rugged: { ...ISLAND_DEFAULTS, coastRoughness: 0.60, terrainRoughness: 0.65, plateauSize: 4, mountainFraction: 0.28, beachWidth: 3 },
} satisfies Record<string, Readonly<IslandSettings>>;

export const ISLAND_RANGES: Record<Exclude<keyof IslandSettings, 'debugOreBlock'>, [number, number]> = {
  landFraction: [0.25, 0.75], coastRoughness: [0, 1], beachWidth: [1, 12], terrainRoughness: [0, 1],
  plateauSize: [2, 24], plateauFraction: [0.05, 0.6], mountainFraction: [0.03, 0.4],
  vegetationDensity: [0, 2], rampSpacing: [4, 60], mountainRidges: [0, 5], ridgeStrength: [0, 0.8],
  ridgeWidth: [5, 40], moistureScale: [8, 80], rockScale: [8, 80],
};
const INTEGERS = new Set(['beachWidth', 'plateauSize', 'rampSpacing', 'mountainRidges']);

export function resolveIslandSettings(overrides: Partial<IslandSettings> = {}): IslandSettings {
  const settings = { ...ISLAND_DEFAULTS, ...overrides };
  for (const [name, [min, max]] of Object.entries(ISLAND_RANGES)) {
    const value = settings[name as keyof typeof ISLAND_RANGES];
    if (!Number.isFinite(value) || value < min || value > max || (INTEGERS.has(name) && !Number.isInteger(value))) {
      throw new Error(`Ungültige Inseleinstellung ${name}: erwartet ${min} bis ${max}${INTEGERS.has(name) ? ' (ganzzahlig)' : ''}.`);
    }
  }
  if (typeof settings.debugOreBlock !== 'boolean') throw new Error('debugOreBlock muss wahr oder falsch sein.');
  if (settings.plateauFraction + settings.mountainFraction > 0.85) throw new Error('Mindestens 15 % des Inlandes müssen Tiefland bleiben.');
  return settings;
}
