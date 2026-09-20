export interface ClusterConfig {
  clusterCount: number;
  radius: number;
  density: number;
  spawnOn: string[];
  minQ: number;
  maxQ: number;
  minDistFromSpawn?: number;
}

const configs: Record<string, ClusterConfig> = {
  stone: {
    clusterCount: 6, radius: 14, density: 0.26,
    spawnOn: ['hills', 'mountain'], minQ: 2, maxQ: 5, minDistFromSpawn: 50,
  },
  pebbles: {
    clusterCount: 10, radius: 7, density: 0.38,
    spawnOn: ['beach'], minQ: 1, maxQ: 2, minDistFromSpawn: 3,
  },
  palm_tree: {
    clusterCount: 20, radius: 6, density: 0.35,
    spawnOn: ['beach', 'grass'], minQ: 3, maxQ: 5, minDistFromSpawn: 0,
  },
  resin_tree: {
    clusterCount: 8, radius: 7, density: 0.20,
    spawnOn: ['sparse_forest', 'forest', 'dense_jungle'], minQ: 3, maxQ: 5, minDistFromSpawn: 30,
  },
  rubber_tree: {
    clusterCount: 6, radius: 6, density: 0.15,
    spawnOn: ['dense_jungle'], minQ: 1, maxQ: 1, minDistFromSpawn: 55,
  },
  cacao_tree: {
    clusterCount: 7, radius: 5, density: 0.18,
    spawnOn: ['dense_jungle', 'forest'], minQ: 1, maxQ: 1, minDistFromSpawn: 40,
  },
  fern: {
    clusterCount: 20, radius: 5, density: 0.30,
    spawnOn: ['grass', 'tall_grass', 'sparse_forest', 'dense_jungle'], minQ: 1, maxQ: 1, minDistFromSpawn: 5,
  },
  pandanus: {
    clusterCount: 12, radius: 6, density: 0.22,
    spawnOn: ['sparse_forest', 'beach', 'grass'], minQ: 1, maxQ: 1, minDistFromSpawn: 10,
  },
  breadfruit_tree: {
    clusterCount: 10, radius: 6, density: 0.18,
    spawnOn: ['forest', 'sparse_forest'], minQ: 1, maxQ: 1, minDistFromSpawn: 20,
  },
  obsidian: {
    clusterCount: 3, radius: 5, density: 0.20,
    spawnOn: ['mountain'], minQ: 1, maxQ: 2, minDistFromSpawn: 80,
  },
  granite: {
    clusterCount: 5, radius: 8, density: 0.25,
    spawnOn: ['mountain', 'hills'], minQ: 1, maxQ: 3, minDistFromSpawn: 60,
  },
};

const rockFormationPasses: Array<[string, ClusterConfig]> = [
  ['granite', { clusterCount: 5, radius: 5, density: 0.40, spawnOn: ['hills', 'grass'],        minQ: 3, maxQ: 5, minDistFromSpawn: 40 }],
  ['stone',   { clusterCount: 7, radius: 4, density: 0.35, spawnOn: ['grass', 'sparse_forest'], minQ: 2, maxQ: 4, minDistFromSpawn: 35 }],
  ['stone',   { clusterCount: 5, radius: 3, density: 0.35, spawnOn: ['beach'],                  minQ: 1, maxQ: 3, minDistFromSpawn: 40 }],
];

const bambooPasses: ClusterConfig[] = [
  { clusterCount: 5,  radius: 12, density: 0.28, spawnOn: ['forest', 'dense_jungle'],              minQ: 1, maxQ: 1, minDistFromSpawn: 20 },
  { clusterCount: 22, radius: 3,  density: 0.45, spawnOn: ['forest', 'dense_jungle', 'sparse_forest'], minQ: 1, maxQ: 1, minDistFromSpawn: 15 },
];
export const ISLAND_RESOURCE_CLUSTERS: Array<[string, ClusterConfig]> = [
  ...Object.entries(configs),
  ...bambooPasses.map(cfg => ['bamboo', cfg] as [string, ClusterConfig]),
  ...rockFormationPasses,
];

export const ISLAND_RESOURCE_LAYOUT = {
  extraSticksFrequency: 0.07,
  largeTreeCount: 50,
  banyanCount: 20,
  largeTreeSpacing: 10,
  largeTreeSpawnDistance: 25,
};
