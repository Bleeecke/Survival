export const DAY_DURATION_MS = 600_000; // 10 min real = 1 game day

export interface ResourceSpawnConfig {
  frequency: number;
  minQuantity: number;
  maxQuantity: number;
  spawnOn?: string[];
}

export const WORLD_CONFIG = {
  width: 250,
  height: 250,
  tileSize: 32,

  // Frequency-based scattered resources
  resources: {
    wood:         { frequency: 0.04,  minQuantity: 1, maxQuantity: 3, spawnOn: ['sparse_forest', 'dense_jungle', 'forest'] },
    berry_bush:   { frequency: 0.006, minQuantity: 1, maxQuantity: 3, spawnOn: ['grass', 'tall_grass', 'sparse_forest'] },
    iron_ore:     { frequency: 0.03,  minQuantity: 1, maxQuantity: 2, spawnOn: ['mountain', 'hills'] },
    flint:        { frequency: 0.018, minQuantity: 1, maxQuantity: 2, spawnOn: ['beach', 'hills'] },
    driftwood:    { frequency: 0.025, minQuantity: 1, maxQuantity: 2, spawnOn: ['beach'] },
    shells:       { frequency: 0.04,  minQuantity: 1, maxQuantity: 2, spawnOn: ['beach'] },
    coconut:      { frequency: 0.04,  minQuantity: 1, maxQuantity: 2, spawnOn: ['beach'] },
    herbs:        { frequency: 0.03,  minQuantity: 1, maxQuantity: 2, spawnOn: ['grass', 'tall_grass', 'sparse_forest'] },
    fiber:        { frequency: 0.035, minQuantity: 1, maxQuantity: 2, spawnOn: ['tall_grass', 'grass'] },
    mushroom:     { frequency: 0.03,  minQuantity: 1, maxQuantity: 2, spawnOn: ['sparse_forest', 'dense_jungle', 'forest'] },
    exotic_fruit: { frequency: 0.012, minQuantity: 1, maxQuantity: 3, spawnOn: ['dense_jungle'] },
    vine:         { frequency: 0.04,  minQuantity: 1, maxQuantity: 2, spawnOn: ['dense_jungle', 'sparse_forest', 'forest'] },
  } as Record<string, ResourceSpawnConfig>,

  startX: 125,
  startY: 210,
};
