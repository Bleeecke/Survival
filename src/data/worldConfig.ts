export const DAY_DURATION_MS = 600_000; // 10 min real = 1 game day

export interface ResourceSpawnConfig {
  frequency: number;
  minQuantity: number;
  maxQuantity: number;
  spawnOn?: string[];
}

export const WORLD_CONFIG = {
  width: 150,
  height: 150,
  tileSize: 32,

  // Noise scales (used by WorldGenerator)
  elevationScale: 40,
  moistureScale: 25,

  // Legacy thresholds (unused by new generator, kept for reference)
  thresholds: {
    water: 0.05,
    beach: 0.18,
    grass: 0.45,
    hills: 0.65,
    mountain: 0.82,
    impassable: 0.93,
  },

  // Frequency-based scattered resources
  resources: {
    wood:         { frequency: 0.04,  minQuantity: 1, maxQuantity: 3, spawnOn: ['sparse_forest', 'dense_jungle', 'forest'] },
    food:         { frequency: 0.025, minQuantity: 1, maxQuantity: 2, spawnOn: ['grass', 'tall_grass', 'sparse_forest'] },
    iron_ore:     { frequency: 0.03,  minQuantity: 1, maxQuantity: 2, spawnOn: ['mountain', 'hills', 'rock'] },
    flint:        { frequency: 0.04,  minQuantity: 1, maxQuantity: 2, spawnOn: ['beach', 'hills'] },
    driftwood:    { frequency: 0.025, minQuantity: 1, maxQuantity: 2, spawnOn: ['beach'] },
    shells:       { frequency: 0.04,  minQuantity: 1, maxQuantity: 2, spawnOn: ['beach'] },
    coconut_shell: { frequency: 0.03, minQuantity: 1, maxQuantity: 2, spawnOn: ['beach'] },
    herbs:        { frequency: 0.03,  minQuantity: 1, maxQuantity: 2, spawnOn: ['grass', 'tall_grass', 'sparse_forest'] },
    fiber:        { frequency: 0.035, minQuantity: 1, maxQuantity: 2, spawnOn: ['tall_grass'] },
    mushroom:     { frequency: 0.03,  minQuantity: 1, maxQuantity: 2, spawnOn: ['sparse_forest', 'dense_jungle', 'forest'] },
    exotic_fruit: { frequency: 0.025, minQuantity: 1, maxQuantity: 2, spawnOn: ['dense_jungle'] },
    vine:         { frequency: 0.04,  minQuantity: 1, maxQuantity: 2, spawnOn: ['dense_jungle', 'sparse_forest'] },
  } as Record<string, ResourceSpawnConfig>,

  startX: 75,
  startY: 75,
};
