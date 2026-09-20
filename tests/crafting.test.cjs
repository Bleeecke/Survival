const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Run the actual TypeScript stores in Node with an isolated in-memory browser storage.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const saved = new Map();
global.window = { localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } };
global.document = { hidden: false };
const { usePlayerStore: player } = require('../src/store/playerStore.ts');
const { useGameStore: game } = require('../src/store/gameStore.ts');
const { useWorldStore: world } = require('../src/store/worldStore.ts');
const { useCraftingStore: craft } = require('../src/store/craftingStore.ts');
const { craftingSystem } = require('../src/services/game/CraftingSystem.ts');
const { getRecipe } = require('../src/data/recipes.ts');
const { DEFAULT_SKILLS } = require('../src/types/skills.ts');
const { rollCraftQuality } = require('../src/data/craftingBalance.ts');
const construction = require('../src/services/game/ConstructionSystem.ts');
const { itemCondition } = require('../src/services/game/inventory.ts');

beforeEach(() => {
  player.getState().reset();
  player.getState().initPlayer('Test');
  player.setState(s => ({ player: { ...s.player, x: 5, y: 5, stats: { ...s.player.stats, fatigue: 0 }, skills: structuredClone(DEFAULT_SKILLS) } }));
  game.setState({ phase: 'playing', isPaused: false, isAwakening: false, showSleepMenu: false, freeCraft: false });
  craft.setState({ job: null, message: '', failures: {} });
  document.hidden = false;
  world.getState().initializeWorld({ seed: 1, width: 20, height: 20, tileMap: Array.from({ length: 20 }, (_, y) => Array.from({ length: 20 }, (_, x) => ({ x, y, walkable: true, type: 'grass' }))), resources: [], structures: [], droppedItems: [] });
});
function add(id, quantity = 1, condition) { assert.equal(player.getState().addToInventory(id, quantity, condition), true); }
function count(id) { return craftingSystem.getItemQuantity(player.getState().player.inventory, id); }

test('HTTP browsers can collect new materials and tools without randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const browserCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto) },
  });
  try {
    add('sticks', 1);
    add('sticks', 2);
    add('pebbles', 1);
    add('stone_axe', 2);
    assert.equal(count('sticks'), 3);
    assert.equal(count('pebbles'), 1);
    assert.equal(count('stone_axe'), 2);
    const items = player.getState().player.inventory.items;
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
    for (const item of items) {
      assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
  }
});

test('plans need no material, reserve space, and persist independently of the active job', () => {
  game.setState({ freeCraft: true });
  assert.equal(craft.getState().startBuild('sleeping_spot', 5, 5), true);
  const site = world.getState().world.constructionSites[0];
  assert.equal(construction.toggleReservation(site.id), null);
  assert.notEqual(construction.planConstruction('sleeping_spot', 6, 5), null);
  const savedWorld = JSON.parse(JSON.stringify(world.getState().world));
  world.getState().initializeWorld(savedWorld);
  craft.getState().cancel();
  assert.deepEqual(construction.findSite(site.id), JSON.parse(JSON.stringify(site)));
  assert.equal(construction.toggleReservation(site.id), null);
  assert.equal(construction.planConstruction('sleeping_spot', 6, 5), null);
});

test('supply is all-or-nothing and abandonment returns delivered resources without inventory space', () => {
  add('palm_leaf', 4);
  assert.equal(craft.getState().startBuild('sleeping_spot', 5, 5), true);
  const id = world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(5, 4);
  assert.equal(construction.supplySite(id), null);
  assert.equal(count('palm_leaf'), 0);
  assert.equal(construction.supplySite(id), null);
  assert.equal(construction.abandonSite(id), null);
  assert.equal(world.getState().world.droppedItems.reduce((n,d)=>n+d.quantity,0), 4);
  construction.abandonSite(id);
  assert.equal(world.getState().world.droppedItems.length, 1);
});

test('partial deliveries persist, only take missing quantities and unlock work when complete', () => {
  add('sticks', 3); add('palm_leaf', 10);
  craft.getState().startBuild('palm_shelter', 5, 5);
  player.getState().movePlayer(5, 4);
  const id = world.getState().world.constructionSites[0].id;
  assert.equal(construction.supplySite(id), null);
  assert.equal(count('sticks'),0); assert.equal(count('palm_leaf'),0);
  assert.equal(construction.findSite(id).delivered.sticks,3);
  assert.equal(craft.getState().resumeBuild(id),false);
  world.getState().initializeWorld(JSON.parse(JSON.stringify(world.getState().world)));
  add('sticks',9); add('vine',3);
  assert.equal(construction.supplySite(id),null);
  assert.equal(count('sticks'),4);
  assert.equal(construction.findSite(id).supplied,true);
  assert.equal(craft.getState().resumeBuild(id),true);
});

test('abandoning a partial delivery returns only the actual deposited amounts once', () => {
  add('palm_leaf',2); craft.getState().startBuild('sleeping_spot',5,5);
  const id=world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(5,4);
  assert.equal(construction.supplySite(id),null);
  assert.ok(construction.supplySite(id));
  construction.abandonSite(id);construction.abandonSite(id);
  assert.equal(world.getState().world.droppedItems.reduce((n,d)=>n+d.quantity,0),2);
});

test('work rejects diagonal and wrong-height positions, pauses on hidden tab and prevents concurrent crafting', () => {
  game.setState({ freeCraft: true });
  craft.getState().startBuild('sleeping_spot', 5, 5);
  const id=world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(4,4); assert.equal(craft.getState().resumeBuild(id),false);
  player.getState().movePlayer(5,4);
  world.getState().world.tileMap[4][5].elevation=2;
  assert.equal(craft.getState().resumeBuild(id),false);
  world.getState().world.tileMap[4][5].elevation=undefined;
  assert.equal(craft.getState().resumeBuild(id),true);
  assert.equal(craft.getState().start('knap_flint'),false);
  document.hidden=true; craft.getState().update(1000); assert.equal(construction.findSite(id).completed,0);
  document.hidden=false; craft.getState().update(1000);
  const done=construction.findSite(id).completed; assert.ok(done>0);
  craft.getState().cancel(); craft.getState().update(10000);
  assert.equal(construction.findSite(id).completed,done);
});

test('sleeping spot upgrade preserves identity and damage and consumes only additional material', () => {
  world.getState().placeStructure('sleeping_spot',5,5);
  const old=world.getState().world.structures[0];
  world.getState().updateStructure(old.id,{health:60});
  add('sticks',8);add('palm_leaf',6);add('vine',3);
  assert.equal(construction.planConstruction('palm_shelter',5,5,old.id),null);
  const id=world.getState().world.constructionSites[0].id;
  assert.equal(world.getState().world.structures[0].type,'sleeping_spot');
  player.getState().movePlayer(5,4);construction.supplySite(id);craft.getState().resumeBuild(id);complete();
  const built=world.getState().world.structures[0];
  assert.equal(built.id,old.id);assert.equal(built.type,'palm_shelter');assert.equal(built.width,2);
  assert.equal(built.health/built.maxHealth,0.6);assert.equal(count('palm_leaf'),0);
  craft.getState().update(100000);assert.equal(world.getState().world.structures.length,1);
});

test('upgrade fails when its additional footprint is occupied', () => {
  game.setState({freeCraft:true});world.getState().placeStructure('sleeping_spot',5,5);
  const old=world.getState().world.structures[0];world.getState().placeStructure('sleeping_spot',6,5);
  assert.ok(construction.planConstruction('palm_shelter',5,5,old.id));
});

test('moving requires packing, physical carrying and rebuilding; interruption preserves cargo', () => {
  game.setState({freeCraft:true});world.getState().placeStructure('campfire',5,5);
  const source=world.getState().world.structures[0];
  assert.ok(construction.planConstruction('campfire',12,5,source.id,true));
  world.getState().updateStructure(source.id,{fuel:0,coldFuel:0.7,health:63});
  assert.equal(construction.planConstruction('campfire',12,5,source.id,true),null);
  const id=world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(5,4);assert.equal(craft.getState().resumeBuild(id),true);complete();
  assert.equal(world.getState().world.structures.length,0);
  assert.equal(construction.findSite(id).phase,'carry');
  assert.equal(craft.getState().resumeBuild(id),true);
  player.getState().movePlayer(8,4);craft.getState().cancel();
  assert.equal(construction.findSite(id).cargoX,8);
  player.getState().movePlayer(12,4);assert.equal(craft.getState().resumeBuild(id),false);
  player.getState().movePlayer(8,4);assert.equal(craft.getState().resumeBuild(id),true);
  player.getState().movePlayer(12,4);craft.getState().update(500);
  assert.equal(construction.findSite(id).phase,'build');
  assert.equal(world.getState().world.structures.length,0);
  craft.getState().resumeBuild(id);complete();
  const moved=world.getState().world.structures[0];
  assert.equal(moved.x,12);assert.equal(moved.id,source.id);assert.equal(moved.health,63);assert.equal(moved.coldFuel,0.7);
});

test('burning, cooling and filled objects cannot be packed', () => {
  game.setState({freeCraft:true,elapsedTime:0});world.getState().placeStructure('campfire',5,5);
  const source=world.getState().world.structures[0];
  world.getState().updateStructure(source.id,{fuel:0,coolingUntil:5000});
  construction.planConstruction('campfire',12,5,source.id,true);
  const id=world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(5,4);assert.equal(craft.getState().resumeBuild(id),false);
  game.setState({elapsedTime:5000});assert.equal(craft.getState().resumeBuild(id),true);
  craft.getState().cancel();
  world.getState().placeStructure('storage_box',2,12);
  const box=world.getState().world.structures.at(-1);
  world.getState().updateStructureStorage(box.id,[{resourceId:'wood',quantity:2}]);
  assert.ok(construction.planConstruction('storage_box',10,12,box.id,true));
});

test('partly built abandonment returns salvage once and never awards completion XP', () => {
  add('palm_leaf',4); craft.getState().startBuild('sleeping_spot',5,5);
  const id=world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(5,4);construction.supplySite(id);craft.getState().resumeBuild(id);
  craft.getState().update(1000);craft.getState().cancel();
  construction.abandonSite(id);construction.abandonSite(id);
  assert.equal(world.getState().world.droppedItems.reduce((n,d)=>n+d.quantity,0),2);
  assert.equal(player.getState().player.skills.building.xp,0);
});

test('saved cargo keeps its position, condition and target while work stays stopped', () => {
  game.setState({freeCraft:true});world.getState().placeStructure('arbeitsplatz',5,5);
  const source=world.getState().world.structures[0];
  construction.planConstruction('arbeitsplatz',12,5,source.id,true);
  const id=world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(5,4);craft.getState().resumeBuild(id);complete();
  craft.getState().resumeBuild(id);player.getState().movePlayer(8,4);craft.getState().cancel();
  const snapshot=JSON.parse(JSON.stringify(world.getState().world));
  world.getState().initializeWorld(snapshot);
  assert.equal(construction.findSite(id).cargoX,8);
  assert.equal(construction.findSite(id).cargo.id,source.id);
  craft.getState().update(100000);assert.equal(world.getState().world.structures.length,0);
});

test('legacy day construction migrates once with prepaid materials and preserved footprint', () => {
  const {migrateConstruction}=require('../src/services/game/constructionMigration.ts');
  const migrated=migrateConstruction({...world.getState().world,structures:[{id:'old',type:'construction_site',constructionTarget:'wooden_shelter',constructionDaysLeft:1,x:5,y:5,health:100,maxHealth:100}]});
  assert.equal(migrated.structures.length,0);assert.equal(migrated.constructionSites[0].completed,60000);
  assert.equal(migrated.constructionSites[0].supplied,true);assert.equal(migrated.constructionSites[0].width,1);
  assert.deepEqual(migrateConstruction(migrated),migrated);
});
function complete(roll = 0.8) {
  const original = Math.random;
  Math.random = () => roll;
  try { craft.getState().update(craft.getState().job.duration); } finally { Math.random = original; }
}

test('one shared job; cancellation consumes no materials and awards no XP', () => {
  add('flint'); add('pebbles');
  assert.equal(craft.getState().start('knap_flint'), true);
  assert.equal(craft.getState().start('knap_flint'), false);
  craft.getState().cancel();
  assert.equal(count('flint'), 1);
  assert.equal(player.getState().player.skills.crafting.xp, 0);
});

test('failed knapping keeps hammer stone, gives reduced practice XP and improves next attempt', () => {
  add('flint', 3); add('pebbles', 3);
  craft.getState().start('knap_flint'); complete(0);
  assert.equal(count('flint'), 2); assert.equal(count('pebbles'), 3); assert.equal(count('sharp_flint'), 0);
  assert.ok(player.getState().player.skills.crafting.xp > 0);
  assert.equal(craft.getState().failures.knap_flint, 1);
  assert.equal(rollCraftQuality(1, 2, 0), 'rough');
});

test('known recipes survive tool loss; crafting still requires tool', () => {
  add('fiber', 4); add('vine', 2);
  const recipe = getRecipe('rope_fiber');
  assert.equal(craftingSystem.isDiscovered(recipe, player.getState().player.inventory), true);
  assert.equal(craft.getState().start(recipe.id), false);
  add('iron_axe');
  assert.equal(craft.getState().start(recipe.id), true);
});

test('coconut guidance names the missing axe and follows only known crafting steps', () => {
  add('coconut'); add('flint_knife'); add('sharp_flint');
  player.getState().learnKnowledge('knows_tool_binding');
  const recipe = getRecipe('coconut_open');
  assert.match(craftingSystem.getCraftBlockReason(recipe), /Axt/);
  assert.match(craftingSystem.getCraftBlockReason(recipe), /Messer reicht/);
  assert.match(craftingSystem.getCraftGuidance(recipe), /Primitive Axt/);
  assert.doesNotMatch(craftingSystem.getCraftGuidance(recipe), /Ast in Feuer härten/);
  add('sticks'); player.getState().learnKnowledge('knows_fire');
  assert.match(craftingSystem.getCraftGuidance(recipe), /Ast in Feuer härten/);
  assert.match(craftingSystem.getCraftGuidance(recipe), /brennenden Feuerstelle/);
  add('stone_axe');
  assert.equal(craftingSystem.getCraftBlockReason(recipe), null);
  assert.equal(craftingSystem.getCraftGuidance(recipe), null);
});

test('skill shortens time and good quality survives equip, wear, unequip and re-equip', () => {
  add('sharp_flint'); add('sticks'); add('fiber', 3);
  const recipe = getRecipe('flint_knife');
  const slow = craftingSystem.getEffectiveCraftTime(recipe);
  player.setState(s => ({ player: { ...s.player, skills: { ...s.player.skills, crafting: { level: 10, xp: 0 } } } }));
  assert.ok(craftingSystem.getEffectiveCraftTime(recipe) < slow);
  assert.equal(craft.getState().start('flint_knife'), true); complete(0.99);
  const knife = player.getState().player.inventory.items.find(i => i.resourceId === 'flint_knife');
  assert.equal(knife.quality, 'good'); assert.equal(knife.maxDurability, 42);
  player.getState().equip('leftHand', 'flint_knife', knife.id);
  player.getState().damageTool('flint_knife', 5);
  player.getState().unequip('leftHand');
  player.getState().equip('leftHand', 'flint_knife');
  assert.equal(player.getState().player.equipment.leftHand.durability, 37);
  assert.equal(player.getState().player.equipment.leftHand.quality, 'good');
});

test('full inventory cannot silently consume crafting inputs', () => {
  add('flint', 2); add('pebbles', 2);
  player.setState(s => ({ player: { ...s.player, inventory: { ...s.player.inventory, maxSlots: 2 } } }));
  craft.getState().start('knap_flint'); complete();
  assert.equal(count('flint'), 2); assert.equal(count('pebbles'), 2);
  assert.ok(craft.getState().job); assert.match(craft.getState().message, /Inventar voll/);
});

test('knapping can stack its actual result even if other quality variants would not fit', () => {
  add('flint', 2); add('pebbles', 2); add('sharp_flint', 1, { quality: 'standard' });
  player.setState(s => ({ player: { ...s.player, inventory: { ...s.player.inventory, maxSlots: 3 } } }));
  assert.equal(craft.getState().start('knap_flint'), true);
  complete(0.8);
  assert.equal(craft.getState().job, null);
  assert.equal(count('sharp_flint'), 2);
});

test('waiting for inventory space never rerolls the crafting result', () => {
  add('flint', 2); add('pebbles', 2);
  player.setState(s => ({ player: { ...s.player, inventory: { ...s.player.inventory, maxSlots: 2 } } }));
  craft.getState().start('knap_flint'); complete(0.99);
  assert.equal(craft.getState().job.outcome, 'good');
  complete(0);
  assert.equal(craft.getState().job.outcome, 'good');
  player.setState(s => ({ player: { ...s.player, inventory: { ...s.player.inventory, maxSlots: 3 } } }));
  complete(0);
  assert.equal(craft.getState().job, null);
  assert.equal(player.getState().player.inventory.items.find(i => i.resourceId === 'sharp_flint').quality, 'good');
});

test('pause and hidden tab do not advance craft time', () => {
  add('flint'); add('pebbles'); craft.getState().start('knap_flint');
  game.setState({ isPaused: true }); craft.getState().update(1000);
  assert.equal(craft.getState().job.elapsed, 0);
  game.setState({ isPaused: false }); document.hidden = true; craft.getState().update(1000);
  assert.equal(craft.getState().job.elapsed, 0);
});

test('lost ingredients cancel safely; completion cannot repeat', () => {
  add('flint'); add('pebbles'); craft.getState().start('knap_flint');
  player.getState().removeResource('flint', 1); craft.getState().update(100);
  assert.equal(craft.getState().job, null); assert.equal(count('sharp_flint'), 0);
  add('flint'); craft.getState().start('knap_flint'); complete();
  craft.getState().update(10000); assert.equal(count('sharp_flint'), 1);
});

test('building is a persistent plan and only explicit adjacent work advances it', () => {
  add('sticks', 8); add('palm_leaf', 10); add('vine', 3);
  assert.equal(craft.getState().startBuild('palm_shelter', 5, 5), true);
  const id = world.getState().world.constructionSites[0].id;
  craft.getState().update(1000);
  assert.equal(world.getState().world.constructionSites[0].completed, 0);
  player.getState().movePlayer(5, 4);
  assert.equal(construction.supplySite(id), null);
  assert.equal(craft.getState().resumeBuild(id), true);
  craft.getState().update(1000);
  const progress = construction.findSite(id).completed;
  player.getState().movePlayer(15, 15); craft.getState().update(1000);
  assert.equal(construction.findSite(id).completed, progress);
  assert.equal(craft.getState().job, null);
  player.getState().movePlayer(5, 4); craft.getState().resumeBuild(id); complete();
  assert.equal(world.getState().world.structures[0].type, 'palm_shelter');
  assert.equal(player.getState().knowledge.knows_construction, true);
});

test('fire cooking awards XP and unlocks preservation after three meals', () => {
  world.getState().placeStructure('campfire', 5, 5);
  player.getState().learnKnowledge('knows_fire'); add('food', 6);
  for (let n = 0; n < 3; n++) { assert.equal(craft.getState().start('cooked_food'), true); complete(); }
  assert.equal(count('cooked_food'), 6);
  assert.equal(player.getState().knowledge.knows_preservation, true);
  assert.ok(player.getState().player.skills.cooking.level > 1);
});

test('quality and damage survive ground transfer and serialization', () => {
  add('stone_axe', 1, { quality: 'rough', durability: 7, maxDurability: 25 });
  const item = player.getState().player.inventory.items[0];
  assert.equal(world.getState().dropItem(item.resourceId, 1, 5, 5, itemCondition(item)), true);
  player.getState().removeFromInventory(0, 1);
  const restored = JSON.parse(JSON.stringify(world.getState().world.droppedItems[0]));
  add(restored.resourceId, restored.quantity, itemCondition(restored));
  player.getState().equip('leftHand', 'stone_axe');
  assert.equal(player.getState().player.equipment.leftHand.durability, 7);
});

test('missing building skill blocks start and better axes satisfy old axe requirements', () => {
  player.getState().learnKnowledge('knows_construction');
  player.setState({ knownMaterials: ['wood', 'stone'] });
  add('iron_axe');
  assert.equal(world.getState().dropItem('wood', 20, 5, 5), true);
  assert.equal(world.getState().dropItem('stone', 5, 5, 5), true);
  assert.equal(craft.getState().startBuild('wooden_shelter', 5, 5), true);
  const id = world.getState().world.constructionSites[0].id;
  player.getState().movePlayer(5, 4);
  construction.supplySite(id);
  assert.equal(craft.getState().resumeBuild(id), false);
  player.setState(s => ({ player: { ...s.player, skills: { ...s.player.skills, building: { level: 2, xp: 0 } } } }));
  assert.equal(craft.getState().resumeBuild(id), true);
  complete();
  assert.equal(world.getState().world.droppedItems.length, 0);
  assert.equal(world.getState().world.structures.at(-1).type, 'wooden_shelter');
});

test('tools have individual slots and crafting wears inventory tools', () => {
  add('flint_knife', 2);
  assert.equal(player.getState().player.inventory.items.length, 2);
  add('fiber', 4); add('vine', 2);
  craft.getState().start('rope_fiber'); complete();
  const knives = player.getState().player.inventory.items.filter(i => i.resourceId === 'flint_knife');
  assert.deepEqual(knives.map(i => i.durability).sort(), [28, 30]);
});

test('repeated crafting gives less XP and failure cannot become a free resource loop', () => {
  add('flint', 4); add('pebbles', 4);
  craft.getState().start('knap_flint'); complete(0);
  const first = player.getState().player.skills.crafting.xp;
  craft.getState().start('knap_flint'); complete(0);
  const second = player.getState().player.skills.crafting.xp - first;
  assert.ok(second < first);
  assert.equal(count('flint'), 2); assert.equal(count('sharp_flint'), 0);
});

test('save reload keeps quality and wear instead of resetting tool health', () => {
  add('flint_knife', 1, { quality: 'good', maxDurability: 42, durability: 9 });
  player.getState().equip('leftHand', 'flint_knife');
  player.persist.rehydrate();
  assert.equal(player.getState().player.equipment.leftHand.durability, 9);
  assert.equal(player.getState().player.equipment.leftHand.maxDurability, 42);
});

test('all skill outcome probabilities sum to one and mastery eliminates basic failures', () => {
  const { outcomeChances } = require('../src/data/craftingBalance.ts');
  for (let level = 1; level <= 10; level++) {
    const p = outcomeChances(level);
    assert.ok(Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - 1) < 1e-10);
  }
  assert.equal(outcomeChances(10).failure, 0);
});
