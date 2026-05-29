import { DAY_DURATION_MS } from './worldConfig';

// Spoil time in game-ms (DAY_DURATION_MS = 1 game day = 10 min real)
export const FOOD_SPOIL_TIME: Record<string, number> = {
  // Raw meat — spoils very fast (half a day)
  fish:             DAY_DURATION_MS * 0.5,
  boar_meat:        DAY_DURATION_MS * 0.5,
  turtle_meat:      DAY_DURATION_MS * 0.5,
  crab_meat:        DAY_DURATION_MS * 0.5,
  // Raw plant food
  food:             DAY_DURATION_MS * 1.0,   // berries
  mushroom:         DAY_DURATION_MS * 1.5,
  exotic_fruit:     DAY_DURATION_MS * 2.0,
  // Cooked food lasts longer
  cooked_food:      DAY_DURATION_MS * 2.0,
  cooked_fish_meal: DAY_DURATION_MS * 1.5,
  cooked_mushroom:  DAY_DURATION_MS * 2.0,
  cooked_boar:      DAY_DURATION_MS * 2.0,
  cooked_crab:      DAY_DURATION_MS * 1.5,
  cooked_turtle:    DAY_DURATION_MS * 1.5,
  // Medicine
  herbal_remedy:    DAY_DURATION_MS * 4.0,
  // Preserved food — lasts much longer
  smoked_meat:      DAY_DURATION_MS * 7.0,
  dried_fish:       DAY_DURATION_MS * 7.0,
  dried_fruit:      DAY_DURATION_MS * 10.0,
};

export const PERISHABLE_IDS = new Set(Object.keys(FOOD_SPOIL_TIME));

export const FOOD_ITEM_NAMES: Record<string, string> = {
  fish:             'Fisch',
  boar_meat:        'Wildschweinfleisch',
  turtle_meat:      'Schildkrötenfleisch',
  crab_meat:        'Krabbenfleisch',
  food:             'Beeren',
  mushroom:         'Pilze',
  exotic_fruit:     'Exotische Frucht',
  cooked_food:      'Gekochtes Essen',
  cooked_fish_meal: 'Gebratener Fisch',
  cooked_mushroom:  'Gebratene Pilze',
  cooked_boar:      'Gek. Wildschwein',
  cooked_crab:      'Gek. Krabbe',
  cooked_turtle:    'Gek. Schildkröte',
  herbal_remedy:    'Kräutermittel',
  smoked_meat:      'Geräuchertes Fleisch',
  dried_fish:       'Getrockneter Fisch',
  dried_fruit:      'Getrocknete Frucht',
};
