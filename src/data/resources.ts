export interface ResourceTypeDef {
  id: string;
  name: string;
  spriteIndex: number;
  gatherTime: number;
  maxStack: number;
  regenerates: boolean;
  regenerationTime?: number;
}

export const RESOURCE_TYPES: Record<string, ResourceTypeDef> = {
  // ── Core materials ────────────────────────────────────────────────
  wood: {
    id: 'wood', name: 'Holz', spriteIndex: 5,
    gatherTime: 1200, maxStack: 99, regenerates: true, regenerationTime: 120_000,
  },
  stone: {
    id: 'stone', name: 'Stein', spriteIndex: 6,
    gatherTime: 2000, maxStack: 50, regenerates: true, regenerationTime: 180_000,
  },
  water: {
    id: 'water', name: 'Wasser', spriteIndex: 7,
    gatherTime: 500, maxStack: 50, regenerates: true, regenerationTime: 10_000,
  },
  food: {
    id: 'food', name: 'Beeren', spriteIndex: 8,
    gatherTime: 800, maxStack: 30, regenerates: true, regenerationTime: 150_000,
  },
  berry_bush: {
    id: 'berry_bush', name: 'Beerenstrauch', spriteIndex: 8,
    gatherTime: 800, maxStack: 10, regenerates: true, regenerationTime: 600_000,
  },
  sticks: {
    id: 'sticks', name: 'Äste', spriteIndex: 9,
    gatherTime: 500, maxStack: 99, regenerates: true, regenerationTime: 60_000,
  },
  pebbles: {
    id: 'pebbles', name: 'Bruchstein', spriteIndex: 10,
    gatherTime: 400, maxStack: 99, regenerates: true, regenerationTime: 120_000,
  },
  spring: {
    id: 'spring', name: 'Quelle', spriteIndex: 11,
    gatherTime: 800, maxStack: 1, regenerates: false, regenerationTime: 0,
  },
  puddle: {
    id: 'puddle', name: 'Pfütze', spriteIndex: 7,
    gatherTime: 600, maxStack: 3, regenerates: false, regenerationTime: 0,
  },
  palm_tree: {
    id: 'palm_tree', name: 'Palme', spriteIndex: 23,
    gatherTime: 800, maxStack: 5, regenerates: true, regenerationTime: 1_800_000,
  },
  fish: {
    id: 'fish', name: 'Fisch', spriteIndex: 12,
    gatherTime: 1500, maxStack: 20, regenerates: true, regenerationTime: 300_000,
  },
  iron_ore: {
    id: 'iron_ore', name: 'Eisenerz', spriteIndex: 13,
    gatherTime: 3000, maxStack: 30, regenerates: true, regenerationTime: 600_000,
  },

  // ── Beach resources ───────────────────────────────────────────────
  flint: {
    id: 'flint', name: 'Feuerstein', spriteIndex: 14,
    gatherTime: 600, maxStack: 50, regenerates: true, regenerationTime: 120_000,
  },
  driftwood: {
    id: 'driftwood', name: 'Treibholz', spriteIndex: 15,
    gatherTime: 700, maxStack: 40, regenerates: true, regenerationTime: 180_000,
  },
  shells: {
    id: 'shells', name: 'Muscheln', spriteIndex: 16,
    gatherTime: 300, maxStack: 60, regenerates: true, regenerationTime: 90_000,
  },
  palm_leaf: {
    id: 'palm_leaf', name: 'Palmenblatt', spriteIndex: 17,
    gatherTime: 500, maxStack: 50, regenerates: true, regenerationTime: 120_000,
  },

  // ── Meadow & tall grass ───────────────────────────────────────────
  herbs: {
    id: 'herbs', name: 'Kräuter', spriteIndex: 18,
    gatherTime: 600, maxStack: 30, regenerates: true, regenerationTime: 120_000,
  },
  fiber: {
    id: 'fiber', name: 'Fasern', spriteIndex: 19,
    gatherTime: 500, maxStack: 60, regenerates: true, regenerationTime: 90_000,
  },

  // ── Forest & jungle ───────────────────────────────────────────────
  mushroom: {
    id: 'mushroom', name: 'Pilze', spriteIndex: 20,
    gatherTime: 700, maxStack: 20, regenerates: true, regenerationTime: 150_000,
  },
  exotic_fruit: {
    id: 'exotic_fruit', name: 'Exotische Frucht', spriteIndex: 21,
    gatherTime: 900, maxStack: 15, regenerates: true, regenerationTime: 1_200_000,
  },
  vine: {
    id: 'vine', name: 'Lianen', spriteIndex: 22,
    gatherTime: 600, maxStack: 40, regenerates: true, regenerationTime: 90_000,
  },

  // ── Animal drops ─────────────────────────────────────────────────
  turtle_meat: {
    id: 'turtle_meat', name: 'Schildkrötenfleisch', spriteIndex: 29,
    gatherTime: 0, maxStack: 20, regenerates: false,
  },
  turtle_shell: {
    id: 'turtle_shell', name: 'Schildkrötenpanzer', spriteIndex: 30,
    gatherTime: 0, maxStack: 5, regenerates: false,
  },
  cooked_turtle: {
    id: 'cooked_turtle', name: 'Gek. Schildkröte', spriteIndex: 31,
    gatherTime: 0, maxStack: 20, regenerates: false,
  },
  crab_meat: {
    id: 'crab_meat', name: 'Krabbenfleisch', spriteIndex: 27,
    gatherTime: 0, maxStack: 20, regenerates: false,
  },
  cooked_crab: {
    id: 'cooked_crab', name: 'Gek. Krabbe', spriteIndex: 28,
    gatherTime: 0, maxStack: 20, regenerates: false,
  },

  // ── Special resources ─────────────────────────────────────────────
  resin_tree: {
    id: 'resin_tree', name: 'Harzbaum', spriteIndex: 24,
    gatherTime: 2000, maxStack: 1, regenerates: true, regenerationTime: 300_000,
  },
  tree_resin: {
    id: 'tree_resin', name: 'Baumharz', spriteIndex: 25,
    gatherTime: 0, maxStack: 20, regenerates: false,
  },
  coconut_shell: {
    id: 'coconut_shell', name: 'Kokosschale', spriteIndex: 26,
    gatherTime: 800, maxStack: 10, regenerates: true, regenerationTime: 200_000,
  },
  coconut: {
    id: 'coconut', name: 'Kokosnuss', spriteIndex: 26,
    gatherTime: 1200, maxStack: 5, regenerates: true, regenerationTime: 300_000,
  },

  // ── Tier-Nebenprodukte ───────────────────────────────────────────────
  bone: {
    id: 'bone', name: 'Knochen', spriteIndex: 10,
    gatherTime: 0, maxStack: 20, regenerates: false,
  },
  hide: {
    id: 'hide', name: 'Tierhaut', spriteIndex: 29,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },
  fat: {
    id: 'fat', name: 'Tierfett', spriteIndex: 25,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },

  // ── Wildschwein drops ─────────────────────────────────────────────
  pandanus: {
    id: 'pandanus', name: 'Pandanus', spriteIndex: 32,
    gatherTime: 0, maxStack: 1, regenerates: false,
  },
  breadfruit_tree: {
    id: 'breadfruit_tree', name: 'Brotfruchtbaum', spriteIndex: 33,
    gatherTime: 0, maxStack: 1, regenerates: false,
  },
  bamboo: {
    id: 'bamboo', name: 'Bambus', spriteIndex: 34,
    gatherTime: 0, maxStack: 1, regenerates: false,
  },
  rubber_tree: {
    id: 'rubber_tree', name: 'Kautschukbaum', spriteIndex: 30,
    gatherTime: 0, maxStack: 1, regenerates: false,
  },
  cacao_tree: {
    id: 'cacao_tree', name: 'Kakaobaum', spriteIndex: 31,
    gatherTime: 0, maxStack: 1, regenerates: false,
  },

  // ── Medicine & First Aid ─────────────────────────────────────────────
  bandage: {
    id: 'bandage', name: 'Verband', spriteIndex: 19,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },
  fever_tea: {
    id: 'fever_tea', name: 'Fiebertee', spriteIndex: 7,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },
  antiparasitic: {
    id: 'antiparasitic', name: 'Parasitenmedizin', spriteIndex: 18,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },

  // ── Seltene Steine ───────────────────────────────────────────────────
  obsidian: {
    id: 'obsidian', name: 'Obsidian', spriteIndex: 6,
    gatherTime: 3000, maxStack: 10, regenerates: true, regenerationTime: 900_000,
  },
  granite: {
    id: 'granite', name: 'Granit', spriteIndex: 6,
    gatherTime: 2500, maxStack: 30, regenerates: true, regenerationTime: 600_000,
  },

  // ── Preserved food ───────────────────────────────────────────────────
  smoked_meat: {
    id: 'smoked_meat', name: 'Geräuchertes Fleisch', spriteIndex: 29,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },
  dried_fish: {
    id: 'dried_fish', name: 'Getrockneter Fisch', spriteIndex: 12,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },
  dried_fruit: {
    id: 'dried_fruit', name: 'Getrocknete Frucht', spriteIndex: 21,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },

  // ── Shell tools ──────────────────────────────────────────────────────
  shell_knife: {
    id: 'shell_knife', name: 'Muschelklinge', spriteIndex: 16,
    gatherTime: 0, maxStack: 5, regenerates: false,
  },

  // ── Intermediate crafting materials ──────────────────────────────────
  sharp_flint: {
    id: 'sharp_flint', name: 'Gespl. Feuerstein', spriteIndex: 14,
    gatherTime: 0, maxStack: 20, regenerates: false,
  },
  hardened_stick: {
    id: 'hardened_stick', name: 'Gehärteter Ast', spriteIndex: 9,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },

  boar_meat: {
    id: 'boar_meat', name: 'Wildschweinfleisch', spriteIndex: 29,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },
  cooked_boar: {
    id: 'cooked_boar', name: 'Gek. Wildschwein', spriteIndex: 31,
    gatherTime: 0, maxStack: 10, regenerates: false,
  },
};
