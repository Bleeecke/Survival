/**
 * Knowledge flags — what the player has understood through experience.
 * Never shown as abstract strings. Each flag shows an "Aha-Moment" toast once.
 */

export const KNOWLEDGE_FLAGS = {
  // ── Starting knowledge (true from game start) ──────────────────────
  knows_basic_rest:      'knows_basic_rest',      // can improvise a sleeping spot
  knows_basic_storage:   'knows_basic_storage',   // can mark a place to store things

  // ── Early discovery ────────────────────────────────────────────────
  knows_basic_fire:      'knows_basic_fire',       // sticks + stones → fire possible
  knows_sharp_edges:     'knows_sharp_edges',      // flint can be knapped into a blade
  knows_hardened_wood:   'knows_hardened_wood',    // fire hardens wood
  knows_binding:         'knows_binding',          // fiber/vine can bind things
  knows_tool_binding:    'knows_tool_binding',     // blade + handle = tool
  knows_basic_weapon:    'knows_basic_weapon',     // pointed stick = weapon

  // ── Weather-triggered ──────────────────────────────────────────────
  knows_basic_shelter:   'knows_basic_shelter',   // rain + palm_leaf → roof idea
  knows_rain_collection: 'knows_rain_collection', // rain + hollow shell → water idea

  // ── Later discovery ────────────────────────────────────────────────
  knows_fire:            'knows_fire',         // controlled fire (from campfire build)
  knows_cooking:         'knows_cooking',      // heat makes food safer
  knows_preservation:    'knows_preservation', // food can be preserved
  knows_construction:    'knows_construction', // stable structures
  knows_medicine:        'knows_medicine',     // plants can heal
  knows_metal:           'knows_metal',        // ore potential
} as const;

export type KnowledgeFlag = typeof KNOWLEDGE_FLAGS[keyof typeof KNOWLEDGE_FLAGS];

// Shown as toast when a flag is first unlocked
export const KNOWLEDGE_INSIGHTS: Record<KnowledgeFlag, string> = {
  knows_basic_rest:      'Du weißt: Ein weiches Lager ist besser als blanker Boden. 🌿',
  knows_basic_storage:   'Du weißt: Ein fester Ablageort hält dein Lager geordnet. 📦',
  knows_basic_fire:      'Du erkennst: Äste und Steine könnten eine Feuerstelle ergeben. 🔥',
  knows_sharp_edges:     'Der Feuerstein splittert scharf. Daraus könnte eine primitive Klinge entstehen. 🪨',
  knows_hardened_wood:   'Die Hitze macht Holz härter. Ein Ast im Feuer wird zäher und stabiler. 🌿',
  knows_binding:         'Mit Fasern lassen sich Stein und Holz fest verbinden. 🌾',
  knows_tool_binding:    'Du verstehst: Klinge und Griff ergeben ein richtiges Werkzeug. 🪓',
  knows_basic_weapon:    'Eine scharfe Spitze am Ast – das ist eine Waffe. 🗡️',
  knows_basic_shelter:   'Nach dem Regen ist klar: Ein Dach aus Blättern könnte dich trocken halten. 🌴',
  knows_rain_collection: 'Die Palmblätter leiten Regenwasser ab. Mit einer Schale könntest du es auffangen. 🥥',
  knows_fire:            'Du verstehst, wie Feuer kontrolliert werden kann. 🔥',
  knows_cooking:         'Du erkennst, dass Hitze Nahrung sicherer macht. 🍖',
  knows_preservation:    'Du begreifst, wie man Nahrung haltbar macht. 🥩',
  knows_construction:    'Du verstehst, wie man stabile Strukturen baut. 🏠',
  knows_medicine:        'Du lernst, welche Pflanzen heilen können. 🌿',
  knows_metal:           'Du ahnst das Potenzial dieses rostigen Erzes. ⛏️',
};

export const DEFAULT_KNOWLEDGE: Record<KnowledgeFlag, boolean> = {
  // Start true — player knows these from birth
  knows_basic_rest:      true,
  knows_basic_storage:   true,
  // Everything else discovered in-game
  knows_basic_fire:      false,
  knows_sharp_edges:     false,
  knows_hardened_wood:   false,
  knows_binding:         false,
  knows_tool_binding:    false,
  knows_basic_weapon:    false,
  knows_basic_shelter:   false,
  knows_rain_collection: false,
  knows_fire:            false,
  knows_cooking:         false,
  knows_preservation:    false,
  knows_construction:    false,
  knows_medicine:        false,
  knows_metal:           false,
};

// Short label for UI (CraftingModal, BuildMenu)
export const KNOWLEDGE_LABELS: Record<KnowledgeFlag, string> = {
  knows_basic_rest:      'Einfaches Lager',
  knows_basic_storage:   'Ablagelogik',
  knows_basic_fire:      'Feuerstelle möglich',
  knows_sharp_edges:     'Klingen formen',
  knows_hardened_wood:   'Holz härten',
  knows_binding:         'Fasern binden',
  knows_tool_binding:    'Werkzeug binden',
  knows_basic_weapon:    'Primitive Waffe',
  knows_basic_shelter:   'Dach bauen',
  knows_rain_collection: 'Regenwasser sammeln',
  knows_fire:            'Feuer beherrschen',
  knows_cooking:         'Kochen',
  knows_preservation:    'Konservierung',
  knows_construction:    'Konstruktion',
  knows_medicine:        'Heilkunde',
  knows_metal:           'Metallverarbeitung',
};

/**
 * Single-material pickup → knowledge grant.
 * Only one grant per material (map can't have duplicates).
 * Weather-triggered flags (knows_basic_shelter, knows_rain_collection)
 * are handled separately in GameManager.
 */
export const MATERIAL_KNOWLEDGE_GRANTS: Partial<Record<string, KnowledgeFlag>> = {
  flint:         'knows_sharp_edges',
  sharp_flint:   'knows_sharp_edges',
  pebbles:       'knows_basic_fire',    // pebbles + sticks → fire idea
  fiber:         'knows_binding',
  iron_ore:      'knows_metal',
  herbs:         'knows_medicine',
  coconut_shell: 'knows_rain_collection',
  coconut:       'knows_rain_collection',
};

/**
 * Conditions checked during rain to grant weather-dependent knowledge.
 * Each entry: if player has seen ANY of these materials → grant the flag.
 */
export const RAIN_KNOWLEDGE_GRANTS: { flag: KnowledgeFlag; needsAny: string[] }[] = [
  {
    flag:     'knows_basic_shelter',
    needsAny: ['palm_leaf', 'sticks', 'vine'],
  },
  {
    flag:     'knows_rain_collection',
    needsAny: ['coconut', 'coconut_shell', 'palm_leaf'],
  },
];
