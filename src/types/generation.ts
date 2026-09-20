export interface IslandSettings {
  landFraction: number;
  coastRoughness: number;
  beachWidth: number;
  terrainRoughness: number;
  plateauSize: number;
  plateauFraction: number;
  mountainFraction: number;
  vegetationDensity: number;
  rampSpacing: number;
  mountainRidges: number;
  ridgeStrength: number;
  ridgeWidth: number;
  moistureScale: number;
  rockScale: number;
  debugOreBlock: boolean;
}

export interface IslandGeneration {
  version: 2;
  settings: IslandSettings;
}
