import rawResources from './json/resources.json';

export interface ResourceTypeDef {
  id: string;
  name: string;
  spriteIndex: number;
  gatherTime: number;
  maxStack: number;
  regenerates: boolean;
  regenerationTime?: number;
}

export const RESOURCE_TYPES: Record<string, ResourceTypeDef> = Object.fromEntries(
  (rawResources as ResourceTypeDef[]).map(r => [r.id, r])
);
