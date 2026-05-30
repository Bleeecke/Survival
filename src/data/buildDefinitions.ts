import type { SkillId } from '../types/skills';
import type { KnowledgeFlag } from './knowledge';
import rawBuilds from './json/buildDefinitions.json';

export type BuildCategory =
  | 'survival' | 'fire' | 'shelter' | 'storage'
  | 'water' | 'food' | 'workstation' | 'hunting' | 'medicine';

export interface BuildMaterial { item: string; amount: number; }
export interface BuildSkillReq  { skill: SkillId; level: number; }

export interface PlacementRules {
  blockedTerrain?: string[];
  requiresOpenSky?: boolean;
  requiresNearbyFire?: boolean;
  noOverlap?: boolean;
}

export interface BuildDefinition {
  id: string;
  name: string;
  icon: string;
  category: BuildCategory;
  description: string;
  effects: string[];
  requiredMaterials: BuildMaterial[];
  requiredTools: string[];
  requiredSkills: BuildSkillReq[];
  requiredKnowledge: KnowledgeFlag[];
  visibleWhenSeen: string[];
  buildTime: number;
  grantsKnowledge?: KnowledgeFlag[];
  placementRules?: PlacementRules;
}

export const BUILD_DEFINITIONS: BuildDefinition[] = rawBuilds as BuildDefinition[];

export const BUILD_CATEGORY_LABELS: Record<BuildCategory, { label: string; icon: string }> = {
  survival:    { label: 'Überleben',    icon: '🏕️' },
  fire:        { label: 'Feuer',        icon: '🔥' },
  shelter:     { label: 'Schutz',       icon: '🏠' },
  storage:     { label: 'Lager',        icon: '📦' },
  water:       { label: 'Wasser',       icon: '💧' },
  food:        { label: 'Nahrung',      icon: '🍖' },
  workstation: { label: 'Werkstätten',  icon: '🪚' },
  hunting:     { label: 'Jagd',         icon: '🏹' },
  medicine:    { label: 'Medizin',      icon: '🌿' },
};

export function getBuildDefinition(id: string): BuildDefinition | undefined {
  return BUILD_DEFINITIONS.find(d => d.id === id);
}
