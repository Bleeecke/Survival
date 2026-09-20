import { buildTrails, drawTrails, type TrailSegment } from './TrailArt';
import { findSite, expansionTarget, planConstruction } from '../game/ConstructionSystem';
import { buildWidth } from '../../data/construction';
import { drawCliffs } from './CliffArt';
import { drawCamp, drawConstruction } from './CampArt';
import { SpriteFactory } from './SpriteFactory';
import { drawResourceArt } from './ResourceArt';
import { drawTreeArt } from './TreeArt';
import { drawTerrain, drawTerrainEdges, artHash } from './TerrainArt';
import { canPlaceBuilding } from '../game/BuildingSystem';
import { useCraftingStore } from '../../store/craftingStore';
import Phaser from 'phaser';
import { GameLoop } from '../game/GameLoop';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { WORLD_CONFIG, DAY_DURATION_MS } from '../../data/worldConfig';
import { restoreWorld } from './restoreWorld';
import { RAIN_KNOWLEDGE_GRANTS } from '../../data/knowledge';
import { useTutorialStore } from '../../store/tutorialStore';
import { FootstepAudio } from '../game/FootstepAudio';
import { GATHER_SKILL_XP } from '../../types/skills';
import { TOOL_DAMAGE_ON_GATHER, SPEAR_DAMAGE_PER_HIT } from '../../data/toolDurability';
import { calcWeight, MAX_CARRY_KG } from '../../data/weights';
import { FOOD_SPOIL_TIME, FOOD_ITEM_NAMES } from '../../data/foodDecay';
import { useJournalStore } from '../../store/journalStore';
import { DISEASE_DRAIN, COLD_EXPOSURE_THRESHOLD, FEVER_FROM_COLD_CHANCE,
         INJURY_DRAIN, BLEED_ON_BOAR_ATTACK, BLEED_DURATION } from '../../data/diseases';
import { getAmbientTemp } from '../../utils/weather';

const TS = WORLD_CONFIG.tileSize; // 32px
const SIGHT_DAY = 12;
const SIGHT_NIGHT = 2;
const CAMPFIRE_SIGHT = 5; // extra tiles lit around a campfire at night

export class GameManager {
  private game: Phaser.Game | null = null;
  private gameLoop = new GameLoop();
  private craftingDelta = 0;
  private scene: Phaser.Scene | null = null;
  private worldUnsubscribe: (() => void) | null = null;
  private gameUnsubscribe: (() => void) | null = null;

  // Depth system:
  //   tiles=0, obj_shadow=ty*1000+1, obj=ty*1000+2, player=ty*1000+3
  //   fog=500_000, overlay=600_000, floatingText=700_000
  private tileGraphics: Phaser.GameObjects.Graphics | null = null;
  private playerGraphics: Phaser.GameObjects.Graphics | null = null;
  private fogGraphics: Phaser.GameObjects.Graphics | null = null;
  private dayNightRect: Phaser.GameObjects.Rectangle | null = null;
  private lightGraphics: Phaser.GameObjects.Graphics | null = null;

  // Individual y-sorted objects
  private resourceObjects = new Map<string, Phaser.GameObjects.Graphics | Phaser.GameObjects.Image>();
  private resourceQuantities = new Map<string, number>();
  private structureObjects = new Map<string, Phaser.GameObjects.Graphics>();
  private droppedItemObjects = new Map<string, Phaser.GameObjects.Graphics>();
  private fireGraphics: Phaser.GameObjects.Graphics | null = null;
  private warmthGraphics: Phaser.GameObjects.Graphics | null = null;
  private shipwreckGraphics: Phaser.GameObjects.Graphics | null = null;
  private microsleepOverlay: Phaser.GameObjects.Rectangle | null = null;
  private awakeningOverlay: Phaser.GameObjects.Rectangle | null = null;
  private awakeningTimer = 0;
  private readonly AWAKENING_DURATION = 16000; // 16s total
  private awakeningPose = 0; // 0=lying, 1=standing
  private placementGraphics: Phaser.GameObjects.Graphics | null = null;
  private constructionGraphics: Phaser.GameObjects.Graphics | null = null;
  private constructionArtKey = "";
  private placementTileX = -1;
  private placementTileY = -1;
  private isRaining = false;
  private rainTimer = 0;
  private rainType: 'drizzle'|'shower'|'rain'|'downpour'|'storm'|'long_rain' = 'rain';
  private rainDuration = 2000; // ticks
  private lightningTimer = 0;
  private nextLightning = 0;
  private rainGraphics: Phaser.GameObjects.Graphics | null = null;
  private rainOverlay: Phaser.GameObjects.Rectangle | null = null;
  private lightningOverlay: Phaser.GameObjects.Rectangle | null = null;
  private lightningBoltGraphics: Phaser.GameObjects.Graphics | null = null;
  private lightningBoltTimer = 0;
  private rainDrops: { x: number; y: number; speed: number; len: number }[] = [];
  private rainAudioNode: AudioNode | null = null;
  private rainGainNode: GainNode | null = null;

  // Turtles
  private turtles: {
    id: string;
    px: number; py: number;
    targetPx: number; targetPy: number;
    state: 'wander' | 'idle' | 'hiding';
    stateTimer: number;
    facingLeft: boolean;
    g: Phaser.GameObjects.Graphics;
  }[] = [];

  // Mouse world position (updated every frame via pointermove)
  private mouseWorldX = 0;
  private mouseWorldY = 0;

  // Spear melee lunge animation
  private spearLunge: {
    angle: number;       // direction of lunge (radians)
    progress: number;    // 0→1→0 (out and back)
    phase: 'out' | 'back';
    g: Phaser.GameObjects.Graphics;
    hitTargets: Set<string>; // ids already damaged this lunge
  } | null = null;
  private spearCooldown = 0; // ms remaining cooldown

  // Crabs
  private crabs: {
    id: string;
    px: number; py: number;
    targetPx: number; targetPy: number;
    state: 'idle' | 'wander' | 'flee';
    stateTimer: number;
    facingLeft: boolean;
    g: Phaser.GameObjects.Graphics;
  }[] = [];

  // Ambient animals (non-huntable)
  private lizards: {
    id: string; px: number; py: number; targetPx: number; targetPy: number;
    state: 'idle' | 'wander' | 'flee'; stateTimer: number; facingLeft: boolean;
    g: Phaser.GameObjects.Graphics;
  }[] = [];

  private parrots: {
    id: string; px: number; py: number;
    state: 'perch' | 'fly'; stateTimer: number;
    arcT: number; arcStartX: number; arcStartY: number; arcEndX: number; arcEndY: number;
    facingLeft: boolean; g: Phaser.GameObjects.Graphics;
  }[] = [];

  private seagulls: {
    id: string; orbitAngle: number; orbitRadius: number; orbitCx: number; orbitCy: number;
    orbitSpeed: number; g: Phaser.GameObjects.Graphics;
  }[] = [];
  private seagullSoundCooldown = 0; // ms until next seagull cry allowed

  private butterflies: {
    id: string; px: number; py: number; targetPx: number; targetPy: number;
    state: 'flutter' | 'rest'; stateTimer: number; phase: number;
    g: Phaser.GameObjects.Graphics;
  }[] = [];

  private rats: {
    id: string; px: number; py: number; targetPx: number; targetPy: number;
    state: 'idle' | 'wander' | 'flee'; stateTimer: number; facingLeft: boolean;
    g: Phaser.GameObjects.Graphics;
  }[] = [];

  // Boars
  private boars: {
    id: string;
    px: number; py: number;
    targetPx: number; targetPy: number;
    health: number;
    state: 'patrol' | 'chase' | 'attack' | 'wary' | 'dead';
    stateTimer: number;
    lastAttack: number;
    hitFlash: number;
    deadAt: number;
    waryTimer: number; // countdown before boar calms down after fire exposure
    facingLeft: boolean;
    g: Phaser.GameObjects.Graphics;
  }[] = [];

  // Stumble (Übermüdet+): freeze movement briefly at random intervals
  private stumbleFreezeMs  = 0;
  private stumbleTimer     = 0;
  private nextStumbleAt    = 7000; // ms until next stumble check

  // Microsleep (Sekundenschlaf): flash to black every ~8s
  private microsleepTimer  = 0;
  private readonly MICROSLEEP_INTERVAL = 8000;
  private jungleTreeObjects: Phaser.GameObjects.Graphics[] = [];
  private jungleCanopyTiles = new Set<string>();
  private jungleCanopyCoveredTiles = new Set<string>(); // tiles under canopy (rain protection + shadow)
  private jungleCanopyMeta = new Map<string, { tx: number; ty: number; seed: number; stripped: boolean; g: Phaser.GameObjects.Graphics }>();
  private vineTreeByResourceId = new Map<string, string>();
  private canopyShadowGraphics: Phaser.GameObjects.Graphics | null = null;

  // Fog of war - local state, not persisted
  private exploredTiles: boolean[][] = [];
  private lastTileViewTx = -1;
  private lastTileViewTy = -1;
  private trails: TrailSegment[] = [];
  private cachedWorld: any = null;
  // Pre-built list of solid blockers {x,y in px, radius} — rebuilt once on world load
  private solidBlockers: Array<{ cx: number; cy: number; r: number }> = [];
  // Fast lookup for grass_tuft tile positions — drawn inline in tile layer, no Phaser objects
  private grassTuftSet = new Set<number>(); // encoded as x + y * mapWidth
  // Fern dew tracking — keys "x,y", reset each new game day
  private dewHarvestedFerns = new Set<string>();
  private lastDewDay = -1;
  private dewTipShown = false;

  private lowHungerTicks = 0;

  private keyPressed = { space: false, e: false, f: false };
  private keys: any = null;
  private playerPx = 0;
  private playerPy = 0;
  private walkFrame = 0;
  private gatherPoseUntil = 0;
  private isMoving = false;
  private lastSaveTime = 0;
  private readonly autoSaveInterval = 30_000;
  private skipFrames = 0;

  // Footstep audio
  private footstepAudio = new FootstepAudio();
  private footstepAccum = 0;          // accumulated distance since last step
  private readonly STEP_DISTANCE = 22; // px between footstep sounds

  // Fishing state
  private fishingStartTime: number | null = null;
  private readonly FISHING_DURATION = 3000;

  // Farm-plot tick
  private farmTick = 0;
  private readonly FARM_INTERVAL = 40_000; // 40s real → food produced

  // Day tracking for campfire fuel drain
  private lastGameDay = -1;
  private decayCheckTick = 0;
  // Rain-fire extinguish accumulator (resets when rain stops)
  private fireRainAccumulator = 0;
  // Ticks spent in rain without shelter (for cold infection)
  private coldExposureTicks = 0;

  constructor(container: HTMLElement) {
    this.initPhaser(container);
  }

  private initPhaser(container: HTMLElement) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: Math.floor(window.innerWidth * 0.75),
      height: window.innerHeight,
      backgroundColor: '#0a0a14',
      // Phaser's focus cooldown otherwise advances only 16.7 ms per frame at low FPS.
      // onUpdate already caps long frame gaps to prevent catch-up jumps.
      fps: { smoothStep: false },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: {
        preload: () => {},
        create: () => this.onCreate(),
        update: (_t, delta) => this.onUpdate(delta),
      },
    });
  }

  private onCreate() {
    this.scene = this.game?.scene.scenes[0] as Phaser.Scene;
    if (!this.scene) return;

    const worldStoreState = useWorldStore.getState();
    let world = worldStoreState.world;
    if (!world) return;

    // Regenerate tileMap from seed if loaded from save (not persisted)
    if (!world.tileMap || world.tileMap.length === 0) {
      world = restoreWorld(world);
      worldStoreState.initializeWorld(world);
    }

    const player = usePlayerStore.getState().player;

    // Init explored tiles grid
    this.exploredTiles = Array.from({ length: WORLD_CONFIG.height }, () =>
      new Array(WORLD_CONFIG.width).fill(false)
    );

    this.tileGraphics = this.scene.add.graphics().setDepth(0);
    this.renderTiles(world);

    // Build collision cache + grass tuft lookup before creating objects
    this.rebuildSolidBlockers(world.resources);

    // Create individual y-sorted objects for resources and structures
    for (const res of world.resources) {
      if (res.quantity > 0) this.createResourceObject(res);
    }
    for (const s of world.structures) {
      this.createStructureObject(s);
    }
    this.createJungleCanopyObjects(world);

    this.playerGraphics = this.scene.add.graphics();

    this.fogGraphics = this.scene.add.graphics().setDepth(500_000);

    // Day/night overlay: plain Rectangle — only alpha changes each frame (no redraw)
    this.dayNightRect = this.scene.add.rectangle(
      0, 0, this.game!.scale.width, this.game!.scale.height, 0x000830
    ).setScrollFactor(0).setDepth(600_000).setOrigin(0, 0).setAlpha(0);

    // Light graphics: drawn above dayNight overlay with ADD blend to brighten campfire areas
    this.lightGraphics = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(600_001)
      .setBlendMode(Phaser.BlendModes.ADD);
    // Fire animation graphics: drawn in world space, depth just above structures
    this.fireGraphics  = this.scene.add.graphics().setDepth(500);
    this.warmthGraphics = this.scene.add.graphics().setDepth(1);

    // Shipwreck — drawn once in world space, depth below player
    this.shipwreckGraphics = this.scene.add.graphics().setDepth(10);
    this.renderShipwreck(world);

    // Microsleep blackout overlay — sits above everything, tweened on stage 4 fatigue
    this.microsleepOverlay = this.scene.add.rectangle(
      0, 0, this.game!.scale.width, this.game!.scale.height, 0x000000
    ).setScrollFactor(0).setDepth(700_000).setOrigin(0, 0).setAlpha(0);

    this.updateConstructionArt();

    // Placement preview graphics — drawn in world space above fog
    this.placementGraphics = this.scene.add.graphics().setDepth(600_500);
    this.constructionGraphics = this.scene.add.graphics();

    // Awakening overlay — above everything, starts fully black (only for new games)
    const isNewGame = useGameStore.getState().isNewGame;
    this.awakeningOverlay = this.scene.add.rectangle(
      0, 0, this.game!.scale.width * 3, this.game!.scale.height * 3, 0x000000
    ).setScrollFactor(0).setDepth(800_000).setOrigin(0, 0).setAlpha(isNewGame ? 1 : 0);
    if (isNewGame) {
      this.awakeningPose = 0;
      useGameStore.getState().setAwakening(true);
      useGameStore.getState().setIsNewGame(false);
    } else {
      this.awakeningPose = 1; // already standing when loading a save
      useGameStore.getState().setAwakening(false);
      useGameStore.getState().setAwakeningBlur(0);
    }

    // Canopy shadow layer (world-space, just above tiles, below objects)
    this.canopyShadowGraphics = this.scene.add.graphics().setDepth(1);

    // Rain graphics (screen-space, above fog but below awakening overlay)
    this.rainOverlay = this.scene.add.rectangle(
      0, 0, this.game!.scale.width, this.game!.scale.height, 0x1a3a6e
    ).setScrollFactor(0).setDepth(550_000).setOrigin(0, 0).setAlpha(0);
    this.lightningOverlay = this.scene.add.rectangle(
      0, 0, this.game!.scale.width, this.game!.scale.height, 0xffffff
    ).setScrollFactor(0).setDepth(550_002).setOrigin(0, 0).setAlpha(0);
    this.lightningBoltGraphics = this.scene.add.graphics().setDepth(550_003).setScrollFactor(0);
    this.rainGraphics = this.scene.add.graphics().setDepth(550_001).setScrollFactor(0);
    this.initRainDrops();

    // Mouse move: track world position for placement preview + weapon aim
    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const wx = ptr.x + this.scene!.cameras.main.worldView.x;
      const wy = ptr.y + this.scene!.cameras.main.worldView.y;
      this.mouseWorldX    = wx;
      this.mouseWorldY    = wy;
      this.placementTileX = Math.floor(wx / TS);
      this.placementTileY = Math.floor(wy / TS);
    });

    // Click: placement confirm OR weapon use
    this.scene.input.on('pointerdown', (_ptr: Phaser.Input.Pointer) => {
      const pm = useGameStore.getState().placementMode;
      if (pm) {
        this.confirmPlacement(pm.recipeId, this.placementTileX, this.placementTileY);
        return;
      }
      const w = useWorldStore.getState().world;
      const tx = Math.floor(this.mouseWorldX / TS), ty = Math.floor(this.mouseWorldY / TS);
      const site = w?.constructionSites?.find(s => ty === s.y && tx >= s.x && tx < s.x + s.width);
      const building = w?.structures.find(s => ty === s.y && tx >= s.x && tx < s.x + (s.width ?? 1));
      if (!site && building?.type === 'arbeitsplatz') {
        const p = usePlayerStore.getState().player;
        if (Math.abs(p.x - building.x) <= 1 && Math.abs(p.y - building.y) <= 1 && w?.tileMap[p.y]?.[p.x]?.elevation === w?.tileMap[building.y]?.[building.x]?.elevation) {
          useGameStore.setState({ constructionSelected: null, craftingOpen: true });
        } else {
          this.spawnFloatingText('Gehe zum Arbeitsplatz, um herzustellen.', building.x, building.y, '#fbbf24');
        }
        return;
      }
      if (site || building) { useGameStore.setState({ constructionSelected: (site ?? building)!.id }); return; }
      this.handleWeaponClick(this.mouseWorldX, this.mouseWorldY);
    });

    // Init pixel position
    this.playerPx = player.x * TS;
    this.playerPy = player.y * TS;

    // Camera setup
    const cam = this.scene.cameras.main;
    cam.setBounds(0, 0, WORLD_CONFIG.width * TS, WORLD_CONFIG.height * TS);
    cam.setLerp(0.1, 0.1);
    cam.centerOn(this.playerPx + TS / 2, this.playerPy + TS / 2);

    // Spawn crabs and turtles on beach tiles
    this.spawnCrabs(world);
    this.spawnTurtles(world);
    this.spawnBoars(world);
    this.spawnLizards(world);
    this.spawnParrots(world);
    this.spawnSeagulls(world);
    this.spawnButterflies(world);
    this.spawnRats(world);

    // Reveal starting area — skip during awakening (fog expands gradually)
    if (!useGameStore.getState().isAwakening) {
      this.markExplored(player.x, player.y, SIGHT_DAY);
      this.updateFog(player.x, player.y, SIGHT_DAY);
    }

    // Rain scheduling — nextRainDay is persisted in store, so reloads don't defer rain
    {
      const startDay = Math.floor(useGameStore.getState().elapsedTime / DAY_DURATION_MS);
      this.lastGameDay = startDay;
    }

    this.worldUnsubscribe = useWorldStore.subscribe((state, prev) => {
      if (state.world) {
        if (state.world.resources !== prev.world?.resources) {
          this.syncResources(state.world);
          this.rebuildSolidBlockers(state.world.resources);
        }
        if (state.world.structures !== prev.world?.structures) this.syncStructures(state.world);
        if (state.world.droppedItems !== prev.world?.droppedItems) this.syncDroppedItems(state.world);
      }
    });

    // Pause/resume GameLoop when store isPaused changes
    this.gameUnsubscribe = useGameStore.subscribe((state, prev) => {
      if (state.isPaused !== prev.isPaused) {
        if (state.isPaused) this.gameLoop.pause();
        else this.gameLoop.resume();
      }
    });

    this.setupInput();
    this.setupVisibilityPause();
    this.updateWorldVisibility();
  }

  private static readonly BLOCKER_RADII: Record<string, number> = {
    palm_tree: 5, large_tree: 6, banyan_tree: 7, resin_tree: 5, wood: 5,
    stone: 13, granite: 13, iron_ore: 12, obsidian: 12,
  };

  private rebuildSolidBlockers(resources: any[]) {
    const radii = GameManager.BLOCKER_RADII;
    this.solidBlockers = [];
    this.grassTuftSet.clear();
    for (const r of resources) {
      if (r.type === 'grass_tuft') {
        this.grassTuftSet.add(r.x + r.y * WORLD_CONFIG.width);
      } else if (radii[r.type] !== undefined) {
        const isTree = r.type === 'palm_tree' || r.type === 'large_tree' || r.type === 'banyan_tree' || r.type === 'resin_tree' || r.type === 'wood';
        this.solidBlockers.push({
          cx: r.x * TS + TS / 2,
          cy: r.y * TS + TS / 2 + (isTree ? 4 : 0),
          r: radii[r.type],
        });
      }
    }
  }

  private setupVisibilityPause() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.game?.loop.sleep();
      this.gameLoop.pause();
    } else {
      this.game?.loop.wake();
      this.game?.loop.resetDelta(); // discard accumulated time while tab was hidden
      this.skipFrames = 3;
      this.gameLoop.resume();
    }
  };

  // ── Tile rendering ────────────────────────────────────────────────

  private renderTiles(world: any) {
    this.cachedWorld = world;
    this.trails = buildTrails(world.tileMap, world.resources);
    this.renderVisibleTiles();
  }

  private renderVisibleTiles() {
    const g = this.tileGraphics!;
    const world = this.cachedWorld;
    if (!g || !world || !this.scene) return;

    const cam = this.scene.cameras.main;
    const tx0 = Math.max(0, Math.floor(cam.worldView.x / TS) - 2);
    const ty0 = Math.max(0, Math.floor(cam.worldView.y / TS) - 2);
    const tx1 = Math.min(world.width  - 1, Math.ceil((cam.worldView.x + cam.worldView.width)  / TS) + 2);
    const ty1 = Math.min(world.height - 1, Math.ceil((cam.worldView.y + cam.worldView.height) / TS) + 2);

    g.clear();
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        this.drawTile(g, world.tileMap[ty][tx].type, tx, ty);
        if (this.grassTuftSet.has(tx + ty * WORLD_CONFIG.width)) {
          this.drawResource(g, 'grass_tuft', tx, ty, 1, 1);
        }
      }
    }
    this.renderTileBlendingViewport(g, world, tx0, ty0, tx1, ty1);
    drawTrails(g, this.trails, tx0, ty0, tx1, ty1, TS);
    this.renderCliffFaces(g, world, tx0, ty0, tx1, ty1);

    this.lastTileViewTx = Math.floor(cam.worldView.x / TS);
    this.lastTileViewTy = Math.floor(cam.worldView.y / TS);
  }

  private renderTileBlendingViewport(g: Phaser.GameObjects.Graphics, world: any, tx0: number, ty0: number, tx1: number, ty1: number) {
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        drawTerrainEdges(g, world.tileMap, tx, ty, TS);
      }
    }
  }

  private renderCliffFaces(g: Phaser.GameObjects.Graphics, world: any, tx0: number, ty0: number, tx1: number, ty1: number) {
    drawCliffs(g, world.tileMap, tx0, ty0, tx1, ty1, TS);
  }

  // Movement gate: can the player step from `from` tile onto `to` tile?
  // Rules (Zelda/Pokemon style):
  //   same elevation  → always allowed
  //   going DOWN 1 tier → allowed (ledge jump)
  //   going UP 1 tier  → only via a ramp tile
  //   diff > 1 in either direction → always blocked
  private canMoveTo(from: { elevation?: number; isRamp?: boolean } | null | undefined,
                    to:   { walkable?: boolean; elevation?: number; isRamp?: boolean } | null | undefined): boolean {
    if (!to?.walkable) return false;
    const fromE = from?.elevation ?? 1;
    const toE   = to.elevation   ?? 1;
    const diff  = toE - fromE;
    if (diff === 0)  return true;
    if (diff === -1) return true; // ledge down — always allowed
    if (diff === 1 && (to.isRamp || from?.isRamp)) return true; // staircase up
    return false;
  }

  private drawTile(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number) {
    drawTerrain(g, type, tx, ty, TS);
  }

  private objectDepth(_tx: number, ty: number) {
    return ty * 1000 + 2;
  }

  private createResourceObject(res: any) {
    if (!this.scene) return;
    // grass_tuft is drawn inline during tile rendering — no persistent Phaser object needed
    if (res.type === 'grass_tuft') return;
    const texture = SpriteFactory.texture(this.scene, res.type, artHash(res.x, res.y) % 3, res.quantity);
    const layout = SpriteFactory.layout(res.type);
    const g = texture
      ? this.scene.add.image(res.x * TS + TS / 2, res.y * TS + TS - 4, texture).setOrigin(0.5, layout.base / layout.height)
      : this.scene.add.graphics();
    const depthTy = (res.type === 'large_tree' || res.type === 'banyan_tree') ? res.y + 1 : res.y;
    g.setDepth(this.objectDepth(res.x, depthTy));
    if (g instanceof Phaser.GameObjects.Graphics) {
      this.drawResource(g, res.type, res.x, res.y, res.quantity, res.maxQuantity);
    }
    this.resourceQuantities.set(res.id, res.quantity);
    this.resourceObjects.set(res.id, g);
  }

  private createStructureObject(s: any) {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    // A leaf bed lies on the terrain, below characters on every adjacent row.
    g.setDepth(s.type === 'sleeping_spot' ? 1.5 : this.objectDepth(s.x, s.y));
    this.drawStructure(g, s.type, s.x, s.y, s.fuel);
    if (['wooden_shelter', 'log_cabin'].includes(s.type) && (s.width ?? 1) > 1) {
      g.setScale(s.width, 1);
      g.setPosition(s.x * TS * (1 - s.width), 0);
    }
    g.setData('buildType', s.type);
    this.structureObjects.set(s.id, g);
  }

  private createJungleCanopyObjects(world: any) {
    if (!this.scene || !world?.tileMap) return;
    for (const g of this.jungleTreeObjects) g.destroy();
    this.jungleTreeObjects = [];
    this.jungleCanopyTiles.clear();
    this.jungleCanopyCoveredTiles.clear();
    this.jungleCanopyMeta.clear();
    this.vineTreeByResourceId.clear();

    const vineNodes = (world.resources ?? []).filter((r: any) => r.type === 'vine' && r.quantity > 0);
    for (const vine of vineNodes) {
      const tx = vine.x;
      const ty = vine.y;
      if (tx < 2 || ty < 2 || tx >= world.width - 2 || ty >= world.height - 2) continue;
      const tile = world.tileMap[ty]?.[tx];
      if (!tile || tile.type !== 'dense_jungle') continue;

      const key = `${tx},${ty}`;
      if (this.jungleCanopyMeta.has(key)) continue;

      const seed = (tx * 928371 + ty * 523543) % 100;
      this.jungleCanopyTiles.add(key);

      // Mark 2-tile radius as covered (rain protection + shadow)
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy <= 4) {
            this.jungleCanopyCoveredTiles.add(`${tx + dx},${ty + dy}`);
          }
        }
      }

      const g = this.scene.add.graphics();
      g.setDepth(this.objectDepth(tx, ty) + 1);
      this.drawJungleCanopyTree(g, tx, ty, seed, false);
      this.jungleTreeObjects.push(g);
      this.jungleCanopyMeta.set(key, { tx, ty, seed, stripped: false, g });
      this.vineTreeByResourceId.set(vine.id, key);
    }

    this.drawCanopyShadows();
    this.renderVisibleTiles();
  }

  private drawCanopyShadows() {
    const g = this.canopyShadowGraphics;
    if (!g) return;
    g.clear();
    for (const meta of this.jungleCanopyMeta.values()) {
      const cx = meta.tx * TS + TS / 2;
      const cy = meta.ty * TS + TS / 2;
      // Large shadow ellipse spanning ~2.5 tiles radius
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(cx, cy - TS * 0.5, TS * 4.5, TS * 2.8);
      // Softer inner highlight to give depth
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(cx, cy - TS * 0.3, TS * 3.0, TS * 1.8);
    }
  }

  private drawJungleCanopyTree(g: Phaser.GameObjects.Graphics, tx: number, ty: number, seed: number, stripped: boolean) {
    const cx = tx * TS + TS / 2, base = ty * TS + TS - 2;
    drawTreeArt(g, 'vine_tree', cx, base, seed % 3, 1);
    if (!stripped) {
      for (let i = 0; i < 5; i++) {
        const x = cx - 35 + i * 17, top = base - 72 - (i % 2) * 9;
        g.lineStyle(1.5, 0x72915a);
        g.beginPath(); g.moveTo(x, top);
        for (let j = 1; j <= 10; j++) {
          g.lineTo(x + Math.sin(j * 0.65 + i) * 4, top + j * 5);
        }
        g.strokePath();
        for (let j = 2; j < 10; j += 3) {
          const lx = x + Math.sin(j * 0.65 + i) * 4, ly = top + j * 5;
          g.fillStyle(0x819b58);
          g.fillTriangle(lx, ly, lx + (i % 2 ? -7 : 7), ly - 3, lx + 2, ly + 4);
        }
      }
    }
  }

  private stripJungleVinesForResource(resourceId: string, px: number, py: number) {
    const mappedKey = this.vineTreeByResourceId.get(resourceId);
    if (mappedKey) {
      const mapped = this.jungleCanopyMeta.get(mappedKey);
      if (mapped && !mapped.stripped) {
        mapped.stripped = true;
        mapped.g.clear();
        this.drawJungleCanopyTree(mapped.g, mapped.tx, mapped.ty, mapped.seed, true);
        return;
      }
    }

    let bestKey: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [key, meta] of this.jungleCanopyMeta.entries()) {
      if (meta.stripped) continue;
      const d = Math.abs(meta.tx - px) + Math.abs(meta.ty - py);
      if (d <= 2 && d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    }
    if (!bestKey) return;
    const meta = this.jungleCanopyMeta.get(bestKey);
    if (!meta) return;
    meta.stripped = true;
    meta.g.clear();
    this.drawJungleCanopyTree(meta.g, meta.tx, meta.ty, meta.seed, true);
  }

  private syncResources(world: any) {
    for (const res of world.resources) {
      const hasObj = this.resourceObjects.has(res.id);
      const alwaysShow = res.type === 'berry_bush' || res.type === 'exotic_fruit' || res.type === 'palm_tree'
        || res.type === 'stone' || res.type === 'iron_ore' || res.type === 'obsidian' || res.type === 'granite';
      if ((res.quantity > 0 || alwaysShow) && !hasObj) {
        this.createResourceObject(res);
      } else if (res.quantity <= 0 && hasObj && !alwaysShow) {
        this.resourceObjects.get(res.id)!.destroy();
        this.resourceObjects.delete(res.id);
        this.resourceQuantities.delete(res.id);
      } else if (hasObj && alwaysShow) {
        // Redraw when quantity changes (leaves, berries, etc.)
        const prev = this.resourceQuantities.get(res.id);
        if (prev !== res.quantity) {
          const g = this.resourceObjects.get(res.id)!;
          if (g instanceof Phaser.GameObjects.Image && this.scene) {
            const texture = SpriteFactory.texture(this.scene, res.type, artHash(res.x, res.y) % 3, res.quantity);
            if (texture) g.setTexture(texture);
          } else if (g instanceof Phaser.GameObjects.Graphics) {
            g.clear();
            this.drawResource(g, res.type, res.x, res.y, res.quantity, res.maxQuantity);
          }
          this.resourceQuantities.set(res.id, res.quantity);
        }
      }
    }
  }

  private syncStructures(world: any) {
    const ids = new Set(world.structures.map((s: any) => s.id));
    for (const [id, g] of this.structureObjects) {
      if (!ids.has(id)) { g.destroy(); this.structureObjects.delete(id); }
    }
    for (const s of world.structures) {
      if (!this.structureObjects.has(s.id)) {
        this.createStructureObject(s);
      } else if (this.structureObjects.get(s.id)!.getData('buildType') !== s.type) {
        this.structureObjects.get(s.id)!.destroy();
        this.createStructureObject(s);
      } else if (s.type === 'water_container') {
        // Redraw when fuel changes so water level updates visually
        const g = this.structureObjects.get(s.id)!;
        g.clear();
        this.drawStructure(g, s.type, s.x, s.y, s.fuel);
      }
    }
  }

  private syncDroppedItems(world: any) {
    const drops: any[] = world.droppedItems ?? [];
    const ids = new Set(drops.map((d: any) => d.id));
    for (const [id, g] of this.droppedItemObjects) {
      if (!ids.has(id)) { g.destroy(); this.droppedItemObjects.delete(id); }
    }
    for (const drop of drops) {
      if (!this.droppedItemObjects.has(drop.id)) {
        this.createDroppedItemObject(drop);
      }
    }
  }

  private static DROP_NAMES: Record<string, string> = {
    wood: 'Holz', stone: 'Stein', sticks: 'Äste', pebbles: 'Bruchstein',
    flint: 'Feuerstein', driftwood: 'Treibholz', shells: 'Muscheln',
    palm_leaf: 'Palmenblatt', herbs: 'Kräuter', fiber: 'Fasern',
    mushroom: 'Pilze', exotic_fruit: 'Exotische Frucht', vine: 'Lianen',
    iron_ore: 'Eisenerz', food: 'Beeren', berry_bush: 'Beeren',
    coconut: 'Kokosnuss', coconut_shell: 'Kokosschale', tree_resin: 'Baumharz',
    fish: 'Fisch', turtle_meat: 'Schildkrötenfleisch', turtle_shell: 'Schildkrötenpanzer',
    crab_meat: 'Krabbenfleisch', cooked_turtle: 'Gek. Schildkröte',
    cooked_crab: 'Gek. Krabbe', water: 'Wasser',
  };

  private createDroppedItemObject(drop: any) {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    g.setDepth(drop.y * 1000 + 1);
    this.drawDroppedItem(g, drop.resourceId, drop.x, drop.y);

    // Hover tooltip
    const cx = drop.x * TS + TS / 2;
    const cy = drop.y * TS + TS / 2;
    g.setInteractive(new Phaser.Geom.Rectangle(cx - 10, cy - 12, 20, 18), Phaser.Geom.Rectangle.Contains);

    let tooltip: Phaser.GameObjects.Container | null = null;

    g.on('pointerover', () => {
      if (!this.scene) return;
      const name = GameManager.DROP_NAMES[drop.resourceId] ?? drop.resourceId;
      const label = `${name}  ×${drop.quantity}`;

      const bg = this.scene.add.graphics();
      const text = this.scene.add.text(0, 0, label, {
        fontSize: '11px',
        color: '#f1f5f9',
        backgroundColor: undefined,
        padding: { x: 0, y: 0 },
      });
      const tw = text.width + 12;
      const th = text.height + 8;
      bg.fillStyle(0x0f172a, 0.9);
      bg.fillRoundedRect(-tw / 2, -th - 2, tw, th, 4);
      bg.lineStyle(1, 0x475569, 0.8);
      bg.strokeRoundedRect(-tw / 2, -th - 2, tw, th, 4);
      text.setPosition(-tw / 2 + 6, -th - 2 + 4);

      tooltip = this.scene.add.container(cx, cy, [bg, text]);
      tooltip.setDepth(drop.y * 1000 + 500);
      tooltip.setScrollFactor(1);
    });

    g.on('pointerout', () => {
      tooltip?.destroy();
      tooltip = null;
    });

    this.droppedItemObjects.set(drop.id, g);
  }

  // Category colors for dropped item bags
  private static DROP_COLORS: Record<string, number> = {
    wood: 0x8b5e3c, driftwood: 0x8b5e3c, sticks: 0x8b5e3c,
    stone: 0x7a7a7a, pebbles: 0x7a7a7a, iron_ore: 0x8b7355, flint: 0xc8a050,
    obsidian: 0x1a1a2e, granite: 0x8a8a8a,
    food: 0xd44030, berry_bush: 0xd44030, exotic_fruit: 0xf5a623,
    mushroom: 0xa0522d, herbs: 0x4a9040, fiber: 0xc8c050, vine: 0x2e8b2e,
    shells: 0xf0e0c0, coconut: 0x8b6914, coconut_shell: 0x8b6914,
    palm_leaf: 0x3a9428, fish: 0x4682b4, tree_resin: 0xd4820a,
    turtle_meat: 0xc05030, turtle_shell: 0x4a6040, crab_meat: 0xe05020,
    cooked_turtle: 0xa03820, cooked_crab: 0xc04010,
    water: 0x38bdf8,
  };

  private drawDroppedItem(g: Phaser.GameObjects.Graphics, resourceId: string, tx: number, ty: number) {
    const cx = tx * TS + TS / 2;
    const cy = ty * TS + TS / 2;
    if (['flint', 'pebbles', 'sticks', 'fiber', 'coconut'].includes(resourceId)) {
      drawResourceArt(g, resourceId, cx, cy + 7, 0, 1);
      return;
    }
    const color = GameManager.DROP_COLORS[resourceId] ?? 0x888888;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(cx, cy + 6, 18, 5);

    // Bag body
    g.fillStyle(color, 0.95);
    g.fillRoundedRect(cx - 7, cy - 6, 14, 12, 3);

    // Bag highlight
    g.fillStyle(0xffffff, 0.15);
    g.fillRoundedRect(cx - 5, cy - 5, 6, 4, 2);

    // Tie at top
    g.fillStyle(color, 1);
    g.fillRect(cx - 3, cy - 10, 6, 5);
    g.fillStyle(0x000000, 0.3);
    g.fillRect(cx - 3, cy - 7, 6, 2);

    // Knot dot
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(cx, cy - 8, 2);
  }

  private drawResource(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number, quantity = 0, maxQuantity = 0) {
    const cx = tx * TS + TS / 2;
    // base = ground anchor at bottom of tile
    const base = ty * TS + TS - 4;
    if (drawResourceArt(g, type, cx, base, artHash(tx, ty) % 3, quantity)) return;

    // Deterministic per-tile size variation for trees (1.2 – 2.1)
    const treeSeed = (tx * 374761 + ty * 914723) % 100;
    const sc = 1.2 + treeSeed / 111; // 1.2 … 2.1

    switch (type) {
      case 'stone': {
        const ow = Math.round(30 * sc), oh = Math.round(24 * sc);
        const otop = base - oh;
        g.fillStyle(0x000000, 0.28);
        g.fillEllipse(cx, base + 4, Math.round(38 * sc), Math.round(10 * sc));
        g.fillStyle(0x404040);
        g.fillEllipse(cx + Math.round(2*sc), base - oh/2 + Math.round(4*sc), ow, oh);
        g.fillStyle(0x717171);
        g.fillEllipse(cx, base - oh/2, ow - Math.round(2*sc), oh - Math.round(2*sc));
        g.fillStyle(0xaaaaaa, 0.65);
        g.fillEllipse(cx - Math.round(6*sc), otop + Math.round(7*sc), Math.round(16*sc), Math.round(9*sc));
        g.fillStyle(0xc8c8c8, 0.35);
        g.fillEllipse(cx - Math.round(3*sc), otop + Math.round(3*sc), Math.round(20*sc), Math.round(6*sc));
        g.fillStyle(0x333333, 0.45);
        g.fillEllipse(cx + Math.round(9*sc), base - Math.round(7*sc), Math.round(9*sc), Math.round(6*sc));
        // cracks
        { const dmg = maxQuantity > 0 ? 1 - quantity / maxQuantity : 0;
          if (dmg > 0.15) { g.lineStyle(Math.round(1.5*sc), 0x000000, 0.7); g.lineBetween(cx, base - Math.round(4*sc), cx - Math.round(8*sc), base - Math.round(16*sc)); g.lineBetween(cx, base - Math.round(4*sc), cx + Math.round(6*sc), base - Math.round(10*sc)); }
          if (dmg > 0.40) { g.lineStyle(Math.round(1.5*sc), 0x000000, 0.6); g.lineBetween(cx - Math.round(8*sc), base - Math.round(16*sc), cx - Math.round(14*sc), base - Math.round(11*sc)); g.lineBetween(cx + Math.round(6*sc), base - Math.round(10*sc), cx + Math.round(12*sc), base - Math.round(6*sc)); g.lineBetween(cx - Math.round(3*sc), base - Math.round(6*sc), cx - Math.round(10*sc), base - Math.round(3*sc)); }
          if (dmg > 0.65) { g.lineStyle(Math.round(2*sc), 0x000000, 0.8); g.lineBetween(cx + Math.round(2*sc), base - Math.round(18*sc), cx + Math.round(10*sc), base - Math.round(22*sc)); g.lineBetween(cx - Math.round(12*sc), base - Math.round(8*sc), cx - Math.round(6*sc), base - Math.round(20*sc)); g.fillStyle(0x222222, 0.4); g.fillEllipse(cx - Math.round(2*sc), base - Math.round(10*sc), Math.round(10*sc), Math.round(7*sc)); }
        }
        break;
      }
      case 'food': {
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(cx, base + 2, 18, 5);
        g.fillStyle(0x577949, 0.9);
        g.fillCircle(cx, base - 10, 10);
        g.fillStyle(0xe74c3c);
        g.fillCircle(cx - 4, base - 12, 3);
        g.fillCircle(cx + 4, base - 11, 3);
        g.fillCircle(cx, base - 6, 3);
        break;
      }
      case 'spring': {
        // Rocky ground around spring
        g.fillStyle(0x000000, 0.25);
        g.fillEllipse(cx, base + 2, 38, 10);
        // Mossy rocks
        g.fillStyle(0x5a5048);
        g.fillEllipse(cx - 10, base - 6, 14, 10);
        g.fillEllipse(cx + 10, base - 4, 12, 9);
        g.fillStyle(0x706860);
        g.fillEllipse(cx - 8, base - 10, 10, 7);
        g.fillEllipse(cx + 9, base - 8, 9, 7);
        // Moss on rocks
        g.fillStyle(0x3a6e28, 0.7);
        g.fillEllipse(cx - 9, base - 13, 8, 4);
        g.fillEllipse(cx + 8, base - 11, 7, 4);
        // Water pool in center
        g.fillStyle(0x1a6eb5, 0.6);
        g.fillEllipse(cx, base - 4, 14, 8);
        g.fillStyle(0x3090d4, 0.8);
        g.fillEllipse(cx, base - 6, 8, 5);
        g.fillStyle(0x7ec8e3, 0.9);
        g.fillEllipse(cx - 1, base - 7, 4, 3);
        // Trickle stream forward
        g.fillStyle(0x1a6eb5, 0.5);
        g.fillRect(cx - 2, base - 2, 4, 8);
        g.fillStyle(0x3090d4, 0.4);
        g.fillRect(cx - 1, base + 2, 2, 5);
        // Rock face above — water seeping out
        g.fillStyle(0x4a4038);
        g.fillRect(cx - 7, base - 20, 14, 14);
        g.fillStyle(0x605848);
        g.fillRect(cx - 6, base - 22, 12, 6);
        g.fillStyle(0x3090d4, 0.6);
        g.fillRect(cx - 2, base - 16, 4, 12);
        g.fillStyle(0x7ec8e3, 0.5);
        g.fillRect(cx - 1, base - 18, 2, 8);
        break;
      }
      case 'puddle': {
        // Muddy ground
        g.fillStyle(0x6b4f2a, 0.4);
        g.fillEllipse(cx, base + 2, 36, 10);
        // Water surface — shallow irregular pool
        g.fillStyle(0x2a7abf, 0.55);
        g.fillEllipse(cx, base - 3, 28, 12);
        g.fillStyle(0x3a9ad4, 0.7);
        g.fillEllipse(cx - 3, base - 5, 18, 7);
        // Highlight shimmer
        g.fillStyle(0xa8d8f0, 0.6);
        g.fillEllipse(cx - 5, base - 7, 7, 3);
        g.fillStyle(0xdff0fb, 0.5);
        g.fillEllipse(cx - 6, base - 8, 3, 2);
        // Small stones at edge
        g.fillStyle(0x8a7a6a, 0.8);
        g.fillCircle(cx + 12, base - 2, 3);
        g.fillCircle(cx - 13, base - 1, 2);
        break;
      }
      case 'fish': {
        g.fillStyle(0x38bdf8, 0.5);
        g.fillEllipse(cx, base - 1, 18, 6);
        g.fillStyle(0x7dd3fc, 0.8);
        g.fillEllipse(cx - 2, base - 3, 8, 4);
        break;
      }
      case 'iron_ore': {
        const ow = Math.round(28 * sc), oh = Math.round(22 * sc);
        const otop = base - oh;
        g.fillStyle(0x000000, 0.28);
        g.fillEllipse(cx, base + 4, Math.round(36 * sc), Math.round(9 * sc));
        // Dark host rock
        g.fillStyle(0x3a3030);
        g.fillEllipse(cx + Math.round(2*sc), base - oh/2 + Math.round(3*sc), ow, oh);
        g.fillStyle(0x524040);
        g.fillEllipse(cx, base - oh/2, ow - Math.round(2*sc), oh - Math.round(2*sc));
        // Ore veins — rust/amber streaks
        g.fillStyle(0x9a3e0a, 0.9);
        g.fillEllipse(cx - Math.round(5*sc), base - Math.round(10*sc), Math.round(14*sc), Math.round(6*sc));
        g.fillStyle(0xc45a10, 0.8);
        g.fillEllipse(cx + Math.round(4*sc), base - Math.round(15*sc), Math.round(9*sc), Math.round(5*sc));
        g.fillStyle(0xe07020, 0.7);
        g.fillEllipse(cx - Math.round(2*sc), base - Math.round(18*sc), Math.round(7*sc), Math.round(4*sc));
        // Surface shimmer
        g.fillStyle(0xf09030, 0.35);
        g.fillEllipse(cx - Math.round(7*sc), otop + Math.round(5*sc), Math.round(12*sc), Math.round(5*sc));
        // cracks
        { const dmg = maxQuantity > 0 ? 1 - quantity / maxQuantity : 0;
          if (dmg > 0.15) { g.lineStyle(Math.round(1.5*sc), 0x1a0a00, 0.75); g.lineBetween(cx, base - Math.round(5*sc), cx - Math.round(7*sc), base - Math.round(15*sc)); g.lineBetween(cx, base - Math.round(5*sc), cx + Math.round(8*sc), base - Math.round(9*sc)); }
          if (dmg > 0.40) { g.lineStyle(Math.round(1.5*sc), 0x1a0a00, 0.65); g.lineBetween(cx - Math.round(7*sc), base - Math.round(15*sc), cx - Math.round(13*sc), base - Math.round(10*sc)); g.lineBetween(cx + Math.round(8*sc), base - Math.round(9*sc), cx + Math.round(11*sc), base - Math.round(4*sc)); g.lineBetween(cx - Math.round(2*sc), base - Math.round(7*sc), cx - Math.round(9*sc), base - Math.round(4*sc)); }
          if (dmg > 0.65) { g.lineStyle(Math.round(2*sc), 0x1a0a00, 0.85); g.lineBetween(cx + Math.round(2*sc), base - Math.round(17*sc), cx + Math.round(9*sc), base - Math.round(21*sc)); g.lineBetween(cx - Math.round(11*sc), base - Math.round(7*sc), cx - Math.round(5*sc), base - Math.round(19*sc)); g.fillStyle(0x1a0a00, 0.45); g.fillEllipse(cx - Math.round(1*sc), base - Math.round(9*sc), Math.round(9*sc), Math.round(6*sc)); }
        }
        break;
      }

      case 'obsidian': {
        const ow = Math.round(26 * sc), oh = Math.round(22 * sc);
        const otop = base - oh;
        g.fillStyle(0x000000, 0.35);
        g.fillEllipse(cx, base + 4, Math.round(34 * sc), Math.round(9 * sc));
        // Volcanic black mass
        g.fillStyle(0x050508);
        g.fillEllipse(cx + Math.round(2*sc), base - oh/2 + Math.round(3*sc), ow, oh);
        g.fillStyle(0x0d0d18);
        g.fillEllipse(cx, base - oh/2, ow - Math.round(2*sc), oh - Math.round(2*sc));
        // Deep blue-purple highlights (glassy surface)
        g.fillStyle(0x1c1c40, 0.9);
        g.fillEllipse(cx - Math.round(5*sc), otop + Math.round(7*sc), Math.round(14*sc), Math.round(8*sc));
        g.fillStyle(0x4040a0, 0.6);
        g.fillEllipse(cx - Math.round(7*sc), otop + Math.round(4*sc), Math.round(10*sc), Math.round(5*sc));
        // Bright glassy sheen
        g.fillStyle(0x9090e0, 0.5);
        g.fillRect(cx - Math.round(8*sc), otop + Math.round(3*sc), Math.round(5*sc), Math.round(2*sc));
        g.fillStyle(0xc0c0ff, 0.3);
        g.fillRect(cx - Math.round(7*sc), otop + Math.round(2*sc), Math.round(3*sc), Math.round(1*sc));
        // cracks (show as bright purple fractures in glass)
        { const dmg = maxQuantity > 0 ? 1 - quantity / maxQuantity : 0;
          if (dmg > 0.15) { g.lineStyle(Math.round(1.5*sc), 0x6060c0, 0.8); g.lineBetween(cx, base - Math.round(4*sc), cx - Math.round(7*sc), base - Math.round(16*sc)); g.lineBetween(cx, base - Math.round(4*sc), cx + Math.round(7*sc), base - Math.round(10*sc)); }
          if (dmg > 0.40) { g.lineStyle(Math.round(1.5*sc), 0x8080d0, 0.7); g.lineBetween(cx - Math.round(7*sc), base - Math.round(16*sc), cx - Math.round(13*sc), base - Math.round(11*sc)); g.lineBetween(cx + Math.round(7*sc), base - Math.round(10*sc), cx + Math.round(12*sc), base - Math.round(5*sc)); g.lineBetween(cx - Math.round(2*sc), base - Math.round(7*sc), cx - Math.round(9*sc), base - Math.round(4*sc)); }
          if (dmg > 0.65) { g.lineStyle(Math.round(2*sc), 0xa0a0f0, 0.9); g.lineBetween(cx + Math.round(2*sc), base - Math.round(18*sc), cx + Math.round(10*sc), base - Math.round(22*sc)); g.lineBetween(cx - Math.round(11*sc), base - Math.round(8*sc), cx - Math.round(5*sc), base - Math.round(20*sc)); g.fillStyle(0x2020508, 0.5); g.fillEllipse(cx - Math.round(1*sc), base - Math.round(10*sc), Math.round(10*sc), Math.round(7*sc)); }
        }
        break;
      }
      case 'granite': {
        const ow = Math.round(32 * sc), oh = Math.round(26 * sc);
        const otop = base - oh;
        g.fillStyle(0x000000, 0.25);
        g.fillEllipse(cx, base + 4, Math.round(40 * sc), Math.round(11 * sc));
        g.fillStyle(0x5a5050);
        g.fillEllipse(cx + Math.round(2*sc), base - oh/2 + Math.round(4*sc), ow, oh);
        g.fillStyle(0x888080);
        g.fillEllipse(cx, base - oh/2, ow - Math.round(2*sc), oh - Math.round(2*sc));
        g.fillStyle(0xb0a8a8, 0.6);
        g.fillEllipse(cx - Math.round(7*sc), otop + Math.round(7*sc), Math.round(18*sc), Math.round(10*sc));
        g.fillStyle(0xc8c0c0, 0.35);
        g.fillEllipse(cx - Math.round(3*sc), otop + Math.round(3*sc), Math.round(22*sc), Math.round(7*sc));
        // Pink feldspar patches
        g.fillStyle(0xc89090, 0.55);
        g.fillCircle(cx + Math.round(5*sc), base - Math.round(9*sc), Math.round(3*sc));
        g.fillCircle(cx - Math.round(8*sc), base - Math.round(7*sc), Math.round(3*sc));
        g.fillCircle(cx + Math.round(2*sc), base - Math.round(17*sc), Math.round(2*sc));
        // Dark mica flecks
        g.fillStyle(0x333333, 0.5);
        g.fillCircle(cx + Math.round(8*sc), base - Math.round(14*sc), Math.round(1.5*sc));
        g.fillCircle(cx - Math.round(4*sc), base - Math.round(6*sc), Math.round(1.5*sc));
        g.fillCircle(cx + Math.round(11*sc), base - Math.round(8*sc), Math.round(1.5*sc));
        // cracks
        { const dmg = maxQuantity > 0 ? 1 - quantity / maxQuantity : 0;
          if (dmg > 0.15) { g.lineStyle(Math.round(1.5*sc), 0x222222, 0.7); g.lineBetween(cx, base - Math.round(5*sc), cx - Math.round(8*sc), base - Math.round(18*sc)); g.lineBetween(cx, base - Math.round(5*sc), cx + Math.round(7*sc), base - Math.round(11*sc)); }
          if (dmg > 0.40) { g.lineStyle(Math.round(1.5*sc), 0x222222, 0.6); g.lineBetween(cx - Math.round(8*sc), base - Math.round(18*sc), cx - Math.round(15*sc), base - Math.round(12*sc)); g.lineBetween(cx + Math.round(7*sc), base - Math.round(11*sc), cx + Math.round(13*sc), base - Math.round(6*sc)); g.lineBetween(cx - Math.round(3*sc), base - Math.round(8*sc), cx - Math.round(11*sc), base - Math.round(4*sc)); }
          if (dmg > 0.65) { g.lineStyle(Math.round(2*sc), 0x111111, 0.85); g.lineBetween(cx + Math.round(3*sc), base - Math.round(20*sc), cx + Math.round(11*sc), base - Math.round(24*sc)); g.lineBetween(cx - Math.round(13*sc), base - Math.round(9*sc), cx - Math.round(6*sc), base - Math.round(22*sc)); g.fillStyle(0x1a1a1a, 0.45); g.fillEllipse(cx - Math.round(2*sc), base - Math.round(11*sc), Math.round(11*sc), Math.round(7*sc)); }
        }
        break;
      }

      // ── New resources (base-anchored) ─────────────────────────────────
      case 'driftwood': {
        const ds = (tx * 531 + ty * 317) % 100;
        const variant = ds % 3; // 0 = large diagonal log, 1 = medium flat, 2 = branch bundle

        if (variant === 0) {
          // Large bleached log lying diagonally — darkish grey-brown
          g.fillStyle(0x000000, 0.18);
          g.fillEllipse(cx + 2, base + 3, 40, 7);
          // Main body — rotated look via stacked ellipses
          g.fillStyle(0x8a7255, 1.0);
          g.fillEllipse(cx - 2, base - 4, 38, 13);
          // Underside shadow
          g.fillStyle(0x4a3c28, 0.6);
          g.fillEllipse(cx - 1, base - 1, 34, 7);
          // Surface grain — lighter strip along top
          g.fillStyle(0xb09870, 0.55);
          g.fillEllipse(cx - 4, base - 8, 24, 5);
          // Bark cracks
          g.lineStyle(1, 0x3a2e1e, 0.7);
          g.lineBetween(cx - 14, base - 4, cx - 6, base - 7);
          g.lineBetween(cx + 2,  base - 3, cx + 10, base - 6);
          g.lineBetween(cx - 2,  base - 5, cx + 3,  base - 3);
          // Left end — cross-section ring
          g.fillStyle(0x6a5538, 0.95);
          g.fillEllipse(cx - 18, base - 4, 11, 13);
          g.fillStyle(0x4a3820, 0.8);
          g.fillEllipse(cx - 18, base - 4, 7, 9);
          g.fillStyle(0x7a6040, 0.5);
          g.fillEllipse(cx - 18, base - 5, 4, 5);
          // Right end
          g.fillStyle(0x6a5538, 0.9);
          g.fillEllipse(cx + 18, base - 4, 9, 11);
          g.fillStyle(0x4a3820, 0.75);
          g.fillEllipse(cx + 18, base - 4, 5, 7);
          // Branch stub
          if (ds % 5 !== 0) {
            g.lineStyle(3, 0x5a4530, 0.85);
            g.lineBetween(cx + 6, base - 10, cx + 14, base - 18);
            g.lineStyle(2, 0x6a5540, 0.6);
            g.lineBetween(cx + 14, base - 18, cx + 18, base - 14);
          }

        } else if (variant === 1) {
          // Medium flat chunk — shorter, rounder, lying flat
          g.fillStyle(0x000000, 0.15);
          g.fillEllipse(cx + 1, base + 2, 28, 6);
          g.fillStyle(0x7a6245, 1.0);
          g.fillEllipse(cx, base - 4, 28, 11);
          g.fillStyle(0x3e2e18, 0.55);
          g.fillEllipse(cx, base - 1, 24, 5);
          g.fillStyle(0xa08860, 0.5);
          g.fillEllipse(cx - 2, base - 7, 14, 4);
          // Bark texture
          g.lineStyle(1, 0x2e2010, 0.65);
          g.lineBetween(cx - 8, base - 4, cx - 2, base - 6);
          g.lineBetween(cx + 3,  base - 3, cx + 8,  base - 5);
          // End caps
          g.fillStyle(0x5e4828, 0.9);
          g.fillEllipse(cx - 13, base - 4, 9, 11);
          g.fillStyle(0x3e2e18, 0.7);
          g.fillEllipse(cx - 13, base - 4, 5, 7);
          g.fillStyle(0x5e4828, 0.85);
          g.fillEllipse(cx + 13, base - 4, 8, 10);
          g.fillStyle(0x3e2e18, 0.65);
          g.fillEllipse(cx + 13, base - 4, 4, 6);

        } else {
          // Small branch bundle — 3 thin pieces at slightly different angles
          g.fillStyle(0x000000, 0.12);
          g.fillEllipse(cx + 1, base + 2, 22, 4);
          // Back branch (darker)
          g.lineStyle(4, 0x4a3820, 0.9);
          g.lineBetween(cx - 10, base, cx + 12, base - 8);
          g.lineStyle(3, 0x6a5030, 0.7);
          g.lineBetween(cx - 10, base, cx + 12, base - 8);
          // Middle branch
          g.lineStyle(4, 0x5a4228, 0.95);
          g.lineBetween(cx - 11, base - 3, cx + 11, base - 3);
          g.lineStyle(3, 0x7a5e38, 0.65);
          g.lineBetween(cx - 11, base - 3, cx + 11, base - 3);
          // Front branch (lighter)
          g.lineStyle(3, 0x6a5030, 0.9);
          g.lineBetween(cx - 9, base - 6, cx + 10, base + 2);
          g.lineStyle(2, 0x8a6e48, 0.6);
          g.lineBetween(cx - 9, base - 6, cx + 10, base + 2);
          // Knot dots
          g.fillStyle(0x3a2810, 0.8);
          g.fillCircle(cx - 3, base - 3, 2);
          g.fillCircle(cx + 4,  base - 5, 1.5);
        }
        break;
      }
      case 'shells': {
        // Shadow
        g.fillStyle(0x000000, 0.12);
        g.fillEllipse(cx, base + 1, 20, 4);

        // Muschel 1 — links, flach liegend, cremeweiß mit Spirallinien
        g.fillStyle(0xf4ead8);
        g.fillEllipse(cx - 5, base - 2, 10, 6);
        g.fillStyle(0xe0d0b8, 0.6);
        g.fillEllipse(cx - 5, base - 2, 7, 4);
        // Spirallinien
        g.lineStyle(0.8, 0xb8a888, 0.7);
        g.lineBetween(cx - 8, base - 1, cx - 3, base - 4);
        g.lineBetween(cx - 7, base - 3, cx - 4, base - 1);
        g.lineStyle(0.6, 0xfff8ee, 0.5);
        g.lineBetween(cx - 6, base - 2, cx - 4, base - 3);

        // Muschel 2 — rechts, aufgerichtet (schmal = Seitenansicht), rosé
        g.fillStyle(0xe8c8b8);
        g.fillEllipse(cx + 5, base - 4, 5, 9);
        g.fillStyle(0xd4a898, 0.7);
        g.fillEllipse(cx + 5, base - 4, 3, 6);
        g.lineStyle(0.7, 0xc09080, 0.6);
        g.lineBetween(cx + 5, base - 7, cx + 5, base - 1);

        // Muschel 3 — vorne mittig, gelblich, flach
        g.fillStyle(0xf0dfa0);
        g.fillEllipse(cx, base + 1, 8, 4);
        g.fillStyle(0xe8d080, 0.5);
        g.fillEllipse(cx, base + 1, 5, 2.5);
        g.lineStyle(0.7, 0xc8b060, 0.55);
        g.lineBetween(cx - 3, base + 1, cx + 3, base);
        break;
      }
      case 'palm_leaf': {
        g.fillStyle(0x3a8c20, 0.9);
        g.fillEllipse(cx - 2, base - 8, 14, 6);
        g.fillStyle(0x4aac30, 0.8);
        g.fillEllipse(cx + 3, base - 3, 12, 5);
        g.lineStyle(1, 0x1a5808, 0.8);
        g.lineBetween(cx - 7, base - 1, cx + 6, base - 11);
        break;
      }
      case 'fern': {
        // Ground shadow
        g.fillStyle(0x000000, 0.12);
        g.fillEllipse(cx, base + 2, 26, 6);
        // Draw a fern frond: stem + pairs of pinnae (leaflets)
        const drawFernFrond = (
          ox: number, angle: number, length: number,
          stemColor: number, leafColor: number, leafAlpha: number
        ) => {
          const rad = angle * Math.PI / 180;
          const cos = Math.cos(rad), sin = Math.sin(rad);
          const perp = { x: -sin, y: cos };
          // Stem
          g.lineStyle(1.2, stemColor, 0.95);
          g.lineBetween(ox, base, ox + cos * length, base + sin * length);
          // Pinnae pairs along stem
          const pairs = 5;
          for (let i = 1; i <= pairs; i++) {
            const t = i / (pairs + 1);
            const sx = ox + cos * length * t;
            const sy = base + sin * length * t;
            const pLen = length * 0.28 * (1 - t * 0.4); // shorter near tip
            const pts1: { x: number; y: number }[] = [];
            const pts2: { x: number; y: number }[] = [];
            const leafN = 5;
            for (let j = 0; j <= leafN; j++) {
              const lt = j / leafN;
              const lx = sx + perp.x * pLen * lt;
              const ly = sy + perp.y * pLen * lt + pLen * 0.3 * lt * lt; // droop
              const hw = pLen * 0.18 * Math.sin(lt * Math.PI);
              pts1.push({ x: lx + cos * hw, y: ly + sin * hw });
            }
            for (let j = leafN; j >= 0; j--) {
              const lt = j / leafN;
              const lx = sx + perp.x * pLen * lt;
              const ly = sy + perp.y * pLen * lt + pLen * 0.3 * lt * lt;
              const hw = pLen * 0.18 * Math.sin(lt * Math.PI);
              pts1.push({ x: lx - cos * hw, y: ly - sin * hw });
            }
            for (let j = 0; j <= leafN; j++) {
              const lt = j / leafN;
              const lx = sx - perp.x * pLen * lt;
              const ly = sy - perp.y * pLen * lt + pLen * 0.3 * lt * lt;
              const hw = pLen * 0.18 * Math.sin(lt * Math.PI);
              pts2.push({ x: lx + cos * hw, y: ly + sin * hw });
            }
            for (let j = leafN; j >= 0; j--) {
              const lt = j / leafN;
              const lx = sx - perp.x * pLen * lt;
              const ly = sy - perp.y * pLen * lt + pLen * 0.3 * lt * lt;
              const hw = pLen * 0.18 * Math.sin(lt * Math.PI);
              pts2.push({ x: lx - cos * hw, y: ly - sin * hw });
            }
            g.fillStyle(leafColor, leafAlpha);
            if (pts1.length >= 3) g.fillPoints(pts1 as Phaser.Math.Vector2[], true);
            if (pts2.length >= 3) g.fillPoints(pts2 as Phaser.Math.Vector2[], true);
          }
        };
        // Three fronds, each arching in a different direction
        drawFernFrond(cx,     -88, 22, 0x1a6b28, 0x2da842, 0.92); // upright center
        drawFernFrond(cx - 3, -108, 20, 0x1a6b28, 0x25963a, 0.85); // lean left
        drawFernFrond(cx + 3, -68,  20, 0x1a6b28, 0x25963a, 0.85); // lean right
        // Bright highlight on center frond tip
        g.fillStyle(0x5de87a, 0.5);
        g.fillCircle(cx, base - 22, 2.5);
        // Dew drops — form 7:00→7:30, peak 7:30–8:30, fade 8:30→9:00
        const _dewHour = ((useGameStore.getState().elapsedTime % DAY_DURATION_MS) / DAY_DURATION_MS) * 24;
        const _fernKey = `${tx},${ty}`;
        const _dewHarvested = this.dewHarvestedFerns.has(_fernKey);
        const dewAlpha = _dewHarvested ? 0
          : _dewHour < 7    ? 0
          : _dewHour < 7.5  ? (_dewHour - 7) / 0.5
          : _dewHour < 8.5  ? 1
          : _dewHour < 9    ? 1 - (_dewHour - 8.5) / 0.5
          : 0;
        if (dewAlpha > 0.01) {
          g.fillStyle(0xb8eaff, 0.85 * dewAlpha);
          g.fillCircle(cx - 6, base - 12, 1.5);
          g.fillCircle(cx + 7, base - 10, 1.2);
          g.fillStyle(0xdff5ff, 0.7 * dewAlpha);
          g.fillCircle(cx - 1, base - 17, 1.3);
        }
        break;
      }
      case 'grass_tuft': {
        // Purely decorative — not gatherable, very short tuft
        g.fillStyle(0x000000, 0.08);
        g.fillEllipse(cx, base + 2, 14, 3);
        const gtBlades: [number, number, number, number][] = [
          [cx - 4, base + 1, cx - 6,  base - 7],
          [cx - 1, base + 1, cx - 1,  base - 9],
          [cx + 2, base + 1, cx + 4,  base - 7],
        ];
        g.lineStyle(1, 0x4a7a20, 0.5);
        for (const [x1, y1, x2, y2] of gtBlades) g.lineBetween(x1, y1 + 1, x2 + 1, y2 + 1);
        g.lineStyle(1, 0x6aaa30, 0.9);
        for (const [x1, y1, x2, y2] of gtBlades) g.lineBetween(x1, y1, x2, y2);
        g.lineStyle(1, 0x8acc50, 0.6);
        g.lineBetween(cx, base + 1, cx + 1, base - 8);
        break;
      }
      case 'mushroom': {
        g.fillStyle(0xf0ebe0);
        g.fillRect(cx - 2, base - 7, 5, 7);
        g.fillStyle(0x8b4513);
        g.fillEllipse(cx, base - 10, 16, 8);
        g.fillStyle(0xa0522d, 0.8);
        g.fillEllipse(cx - 2, base - 13, 8, 4);
        g.fillStyle(0xfff5ee, 0.3);
        g.fillCircle(cx - 2, base - 12, 2);
        break;
      }
      case 'berry_bush': {
        // Shadow
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(cx, base + 1, 22, 5);
        // Main bush — always green
        g.fillStyle(0x2d7a1f);
        g.fillCircle(cx, base - 8, 9);
        g.fillStyle(0x3a9428);
        g.fillCircle(cx - 5, base - 6, 6);
        g.fillCircle(cx + 5, base - 7, 6);
        g.fillStyle(0x4ab033, 0.7);
        g.fillCircle(cx - 2, base - 12, 5);
        g.fillCircle(cx + 3, base - 11, 4);
        // Berries — shown when quantity > 0
        if (quantity > 0) {
          const berryColors = [0xff3333, 0xff6600, 0xffcc00, 0xff4488];
          const positions = [
            [cx - 4, base - 9], [cx + 4, base - 8], [cx, base - 5],
            [cx - 6, base - 7], [cx + 6, base - 9], [cx + 1, base - 13],
            [cx - 3, base - 13],
          ];
          for (let i = 0; i < Math.min(quantity + 2, positions.length); i++) {
            g.fillStyle(berryColors[i % berryColors.length]);
            g.fillCircle(positions[i][0], positions[i][1], 2);
          }
        }
        break;
      }
      case 'exotic_fruit': {
        // Shadow
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(cx, base + 1, 20, 5);
        // Trunk
        g.fillStyle(0x5a3010);
        g.fillRect(cx - 3, base - 22, 6, 22);
        // Canopy layers
        g.fillStyle(0x1a6a08);
        g.fillCircle(cx, base - 26, 11);
        g.fillStyle(0x228b22);
        g.fillCircle(cx - 5, base - 22, 7);
        g.fillCircle(cx + 5, base - 23, 7);
        g.fillStyle(0x2ea824, 0.7);
        g.fillCircle(cx, base - 30, 7);
        // Fruits hanging in canopy — shown when quantity > 0
        if (quantity > 0) {
          const fruitColors = [0xff6b35, 0xffd700, 0xff4500, 0xffb347, 0xda70d6];
          const positions = [
            [cx - 7, base - 21], [cx + 6, base - 22], [cx - 1, base - 19],
            [cx + 3, base - 25], [cx - 4, base - 26], [cx + 8, base - 26],
          ];
          for (let i = 0; i < Math.min(quantity + 1, positions.length); i++) {
            g.fillStyle(fruitColors[i % fruitColors.length]);
            g.fillCircle(positions[i][0], positions[i][1], 3);
            // Small stem
            g.lineStyle(1, 0x2d5a10, 0.8);
            g.lineBetween(positions[i][0], positions[i][1] - 3, positions[i][0], positions[i][1] - 5);
          }
        }
        break;
      }
      case 'vine': {
        g.lineStyle(2, 0x1a6a10, 0.9);
        g.lineBetween(cx - 5, base + 3, cx, base - 6);
        g.lineBetween(cx, base - 6, cx + 4, base - 10);
        g.lineStyle(1, 0x2a8a20, 0.8);
        g.lineBetween(cx - 3, base - 1, cx + 2, base - 5);
        g.fillStyle(0x1e7a14, 0.7);
        g.fillCircle(cx - 2, base - 2, 2);
        g.fillCircle(cx + 3, base - 9, 2);
        break;
      }
      case 'resin_tree': {
        drawTreeArt(g, 'wood', cx, base, artHash(tx, ty) % 3, quantity);
        if (quantity < maxQuantity) {
          g.lineStyle(1.5, 0x453929);
          g.lineBetween(cx - 3, base - 17, cx, base - 20);
          g.lineBetween(cx + 3, base - 17, cx, base - 20);
          g.fillStyle(quantity > 0 ? 0xdca348 : 0x8c6337);
          g.fillEllipse(cx, base - 15, 3, quantity > 0 ? 7 : 3);
          if (quantity > 0) {
            g.fillStyle(0xf1cf7b); g.fillEllipse(cx - 0.5, base - 17, 1, 3);
          }
        }
        break;
      }
      case 'pandanus': {
        // Pandanus (Schraubenpalme) — Stelzwurzeln, lange schmale Blätter
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(cx, base + 3, Math.round(28*sc), Math.round(7*sc));
        // Stelzwurzeln — schräge Stützen, skaliert
        g.lineStyle(Math.round(3*sc), 0x6b4a20, 0.9);
        g.lineBetween(cx, base - Math.round(14*sc), cx - Math.round(10*sc), base + 2);
        g.lineBetween(cx, base - Math.round(14*sc), cx + Math.round(9*sc),  base + 2);
        g.lineBetween(cx, base - Math.round(14*sc), cx - Math.round(4*sc),  base + 3);
        g.lineStyle(Math.round(2*sc), 0x8a6030, 0.7);
        g.lineBetween(cx, base - Math.round(10*sc), cx + Math.round(5*sc),  base + 1);
        // Hauptstamm
        g.fillStyle(0x7a5228);
        g.fillRect(cx - Math.round(4*sc), base - Math.round(32*sc), Math.round(8*sc), Math.round(20*sc));
        g.fillStyle(0x9a6a38, 0.4);
        g.fillRect(cx - Math.round(sc), base - Math.round(32*sc), Math.round(3*sc), Math.round(20*sc));
        // Spiralförmig abstrahlende lange Blätter
        const bladeColors = [0x2e7a1a, 0x388a20, 0x44a028, 0x3a9022];
        const blades = [
          { ax: 0, ay: -32, bx: -22, by: -44 },
          { ax: 0, ay: -32, bx:  22, by: -44 },
          { ax: 0, ay: -32, bx: -18, by: -50 },
          { ax: 0, ay: -32, bx:  16, by: -50 },
          { ax: 0, ay: -32, bx:  -8, by: -54 },
          { ax: 0, ay: -32, bx:   6, by: -30 },
          { ax: 0, ay: -32, bx:  -6, by: -30 },
        ];
        blades.forEach((b, i) => {
          g.lineStyle(Math.round(2.5*sc), bladeColors[i % bladeColors.length], 0.88);
          g.lineBetween(cx + b.ax*sc, base + b.ay*sc, cx + b.bx*sc, base + b.by*sc);
          g.lineStyle(Math.round(sc), 0x1a5010, 0.5);
          g.lineBetween(cx + b.ax*sc, base + b.ay*sc, cx + (b.bx*sc)*0.6, base + b.ay*sc + (b.by - b.ay)*sc*0.5);
        });
        g.fillStyle(0xe8a020, 0.9);
        g.fillEllipse(cx - Math.round(6*sc), base - Math.round(36*sc), Math.round(6*sc), Math.round(10*sc));
        g.fillStyle(0xf0b830, 0.7);
        g.fillEllipse(cx - Math.round(6*sc), base - Math.round(37*sc), Math.round(4*sc), Math.round(7*sc));
        break;
      }
      case 'breadfruit_tree': {
        const th = Math.round(34 * sc);
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(cx, base + 3, Math.round(24*sc), Math.round(7*sc));
        g.fillStyle(0x6a4a28);
        g.fillRect(cx - Math.round(6*sc), base - th, Math.round(12*sc), th);
        g.fillStyle(0x8a6038, 0.4);
        g.fillRect(cx - Math.round(2*sc), base - th, Math.round(4*sc), th);
        g.fillStyle(0x1a5c14, 0.95);
        g.fillCircle(cx, base - th - 8, Math.round(18*sc));
        g.fillStyle(0x247018, 0.9);
        g.fillCircle(cx - Math.round(14*sc), base - th - 2,  Math.round(13*sc));
        g.fillCircle(cx + Math.round(13*sc), base - th - 3,  Math.round(12*sc));
        g.fillStyle(0x2e8420, 0.8);
        g.fillCircle(cx - Math.round(6*sc),  base - th - 16, Math.round(10*sc));
        g.fillCircle(cx + Math.round(7*sc),  base - th - 14, Math.round(10*sc));
        g.fillStyle(0x389428, 0.65);
        g.fillCircle(cx, base - th - 21, Math.round(8*sc));
        g.lineStyle(1, 0x145010, 0.4);
        g.lineBetween(cx - Math.round(14*sc), base - th - 2,  cx - Math.round(22*sc), base - th + 4);
        g.lineBetween(cx + Math.round(13*sc), base - th - 3,  cx + Math.round(20*sc), base - th + 3);
        const bfFruits = [
          { x: cx - Math.round(10*sc), y: base - th },
          { x: cx + Math.round(8*sc),  y: base - th + 2 },
          { x: cx + Math.round(2*sc),  y: base - th - 10 },
        ];
        for (const f of bfFruits) {
          const fr = Math.round(6*sc);
          g.fillStyle(0x000000, 0.15);
          g.fillCircle(f.x + 1, f.y + 2, fr);
          g.fillStyle(0x4a8c18, 0.95);
          g.fillCircle(f.x, f.y, fr);
          g.lineStyle(0.8, 0x386010, 0.5);
          g.lineBetween(f.x - fr, f.y, f.x + fr, f.y);
          g.lineBetween(f.x, f.y - fr, f.x, f.y + fr);
        }
        break;
      }
      case 'bamboo': {
        // Dense bamboo grove: many stalks of varied height/width spread across a wider area
        const bseed = (tx * 1319 + ty * 5003);
        const bRng = (n: number) => ((bseed * (n + 1) * 2654435761) >>> 0) / 0x100000000;

        // Shadow under the whole grove
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(cx, base + 3, Math.round(28 * sc), Math.round(7 * sc));

        // 6 stalks per tile — neighbouring tiles fill in the forest feel
        const stalkCount = 6;
        for (let i = 0; i < stalkCount; i++) {
          const ox   = (bRng(i * 5 + 0) - 0.5) * 24;          // spread ±12px (tighter so gaps show)
          const hPct = 0.4 + bRng(i * 5 + 1) * 0.6;           // 40–100% of max height
          const maxH = 72;
          const hh   = Math.round(maxH * hPct * sc);
          const wPct = 0.5 + bRng(i * 5 + 2) * 0.5;
          const hw   = Math.max(2, Math.round(5 * wPct * sc));
          const lean  = (bRng(i * 5 + 3) - 0.5) * 4;           // slight lean in px at top
          const hx   = cx + Math.round(ox * sc);
          const topX = hx + Math.round(lean);
          const segH  = Math.round(9 * sc);
          const segs  = Math.max(1, Math.floor(hh / segH));

          // Draw stem as a thin quad (leaned)
          g.fillStyle(0x71874b, 0.93);
          g.fillPoints([
            { x: hx - hw / 2,    y: base },
            { x: hx + hw / 2,    y: base },
            { x: topX + hw / 2,  y: base - hh },
            { x: topX - hw / 2,  y: base - hh },
          ].map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
          // Highlight stripe
          g.fillStyle(0x9ca96a, 0.40);
          g.fillPoints([
            { x: hx - hw / 2,          y: base },
            { x: hx - hw / 2 + hw * 0.35, y: base },
            { x: topX - hw / 2 + hw * 0.35, y: base - hh },
            { x: topX - hw / 2,         y: base - hh },
          ].map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
          // Node rings
          g.fillStyle(0x2e6c0a, 0.75);
          for (let s = 1; s < segs; s++) {
            const ry = base - s * segH;
            const rx = hx + Math.round(lean * (s / segs));
            g.fillRect(rx - hw / 2 - 1, ry - 1, hw + 2, 2);
          }
          // Leaves at top (2–3 blades)
          const leafCount = 2 + (bRng(i * 5 + 4) > 0.5 ? 1 : 0);
          for (let l = 0; l < leafCount; l++) {
            const lAngle = (l / leafCount) * Math.PI - Math.PI / 2 + (bRng(i + l * 7) - 0.5) * 1.2;
            const lLen   = Math.round((14 + bRng(i + l * 3) * 10) * sc);
            const lW     = Math.round(4 * sc);
            const lx1 = topX;
            const ly1 = base - hh;
            const lx2 = lx1 + Math.round(Math.cos(lAngle) * lLen);
            const ly2 = ly1 + Math.round(Math.sin(lAngle) * lLen);
            const lxM = lx1 + Math.round(Math.cos(lAngle) * lLen * 0.5 + Math.cos(lAngle + Math.PI / 2) * lW);
            const lyM = ly1 + Math.round(Math.sin(lAngle) * lLen * 0.5 + Math.sin(lAngle + Math.PI / 2) * lW);
            g.fillStyle(0x50a828, 0.88);
            g.fillTriangle(lx1, ly1, lxM, lyM, lx2, ly2);
            g.fillStyle(0x70c840, 0.50);
            g.fillTriangle(lx1, ly1, lxM - 1, lyM - 1, lx2, ly2);
          }
        }
        break;
      }
      case 'rubber_tree': {
        const th = Math.round(36 * sc);
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(cx, base + 3, Math.round(26*sc), Math.round(8*sc));
        g.fillStyle(0xc8a878);
        g.fillRect(cx - Math.round(5*sc), base - th, Math.round(10*sc), th);
        g.fillStyle(0xdec090, 0.5);
        g.fillRect(cx - Math.round(2*sc), base - th, Math.round(4*sc), th);
        g.lineStyle(1.5, 0x7a5a30, 0.9);
        g.lineBetween(cx - Math.round(5*sc), base - Math.round(28*sc), cx + Math.round(5*sc), base - Math.round(22*sc));
        g.lineBetween(cx - Math.round(5*sc), base - Math.round(20*sc), cx + Math.round(5*sc), base - Math.round(14*sc));
        g.lineBetween(cx - Math.round(5*sc), base - Math.round(12*sc), cx + Math.round(5*sc), base - Math.round(6*sc));
        g.fillStyle(0x5a3a15);
        g.fillRect(cx + Math.round(4*sc), base - Math.round(9*sc), Math.round(4*sc), Math.round(3*sc));
        g.fillStyle(0xf5f0e0, 0.92);
        g.fillCircle(cx + Math.round(6*sc), base - Math.round(7*sc), Math.round(2*sc));
        g.fillCircle(cx + Math.round(6*sc), base - Math.round(4*sc), Math.round(1.5*sc));
        g.fillStyle(0x1a5215, 0.95);
        g.fillCircle(cx, base - th - 8, Math.round(16*sc));
        g.fillStyle(0x226a1a, 0.88);
        g.fillCircle(cx - Math.round(12*sc), base - th - 4, Math.round(12*sc));
        g.fillCircle(cx + Math.round(11*sc), base - th - 5, Math.round(11*sc));
        g.fillStyle(0x2e8025, 0.75);
        g.fillCircle(cx - Math.round(5*sc),  base - th - 16, Math.round(9*sc));
        g.fillCircle(cx + Math.round(6*sc),  base - th - 14, Math.round(8*sc));
        g.fillStyle(0x3a9430, 0.55);
        g.fillCircle(cx, base - th - 19, Math.round(6*sc));
        break;
      }
      case 'cacao_tree': {
        const th = Math.round(28 * sc);
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(cx, base + 2, Math.round(20*sc), Math.round(6*sc));
        g.fillStyle(0x5c3418);
        g.fillRect(cx - Math.round(4*sc), base - th, Math.round(8*sc), th);
        g.fillStyle(0x7a4a24, 0.45);
        g.fillRect(cx - Math.round(sc),   base - th, Math.round(3*sc), th);
        const fruits = [
          { ox: -6, oy: -18, col: 0xc84a10 },
          { ox:  5, oy: -14, col: 0xe05a18 },
          { ox: -5, oy: -8,  col: 0xf07020 },
        ];
        for (const f of fruits) {
          const fx = cx + Math.round(f.ox * sc);
          const fy = base + Math.round(f.oy * sc);
          g.fillStyle(0x000000, 0.2);
          g.fillEllipse(fx, fy + Math.round(3*sc), Math.round(8*sc), Math.round(4*sc));
          g.fillStyle(f.col, 0.95);
          g.fillEllipse(fx, fy, Math.round(7*sc), Math.round(11*sc));
          g.lineStyle(0.8, 0x000000, 0.25);
          g.lineBetween(fx - Math.round(sc), fy - Math.round(4*sc), fx - Math.round(sc), fy + Math.round(4*sc));
          g.lineBetween(fx + Math.round(sc), fy - Math.round(4*sc), fx + Math.round(sc), fy + Math.round(4*sc));
          g.lineStyle(1, 0x5c3418, 0.9);
          g.lineBetween(fx, fy - Math.round(5*sc), cx, fy - Math.round(5*sc));
        }
        g.fillStyle(0x1e5c18, 0.95);
        g.fillCircle(cx, base - th - 8, Math.round(13*sc));
        g.fillStyle(0x287020, 0.88);
        g.fillCircle(cx - Math.round(10*sc), base - th - 4, Math.round(10*sc));
        g.fillCircle(cx + Math.round(9*sc),  base - th - 5, Math.round(9*sc));
        g.fillStyle(0x34882a, 0.7);
        g.fillCircle(cx - Math.round(3*sc), base - th - 14, Math.round(7*sc));
        g.fillCircle(cx + Math.round(4*sc), base - th - 12, Math.round(7*sc));
        break;
      }
      case 'coconut_shell': {
        g.fillStyle(0x000000, 0.12);
        g.fillEllipse(cx, base + 1, 14, 4);
        g.fillStyle(0x5c3a18);
        g.fillEllipse(cx, base - 3, 12, 8);
        g.fillStyle(0x7a4e20, 0.7);
        g.fillEllipse(cx - 1, base - 4, 8, 5);
        g.fillStyle(0xc8a870, 0.5);
        g.fillEllipse(cx, base - 2, 6, 3);
        break;
      }

      case 'large_tree': {
        // Deterministic variation per tree
        const lseed = (tx * 491 + ty * 863) % 100;
        const lsc   = 0.88 + lseed / 200; // 0.88–1.38

        // Ground shadow — large, offset SE
        g.fillStyle(0x000000, 0.22);
        g.fillEllipse(cx + Math.round(18*lsc), base + Math.round(12*lsc), Math.round(130*lsc), Math.round(44*lsc));

        // Buttress roots — thick flared base
        const rootAngles = [-55, -20, 20, 55, 90];
        for (const ang of rootAngles) {
          const rad = ang * Math.PI / 180;
          const rx = cx + Math.cos(rad) * Math.round(18*lsc);
          const ry = base + Math.sin(rad) * Math.round(8*lsc);
          g.lineStyle(Math.round((6 - Math.abs(ang) / 30)*lsc), 0x4a3018, 0.85);
          g.lineBetween(cx, base - Math.round(10*lsc), rx, ry);
        }

        // Main trunk — wide, dark
        g.fillStyle(0x3e2810);
        g.fillRect(cx - Math.round(9*lsc), base - Math.round(58*lsc), Math.round(18*lsc), Math.round(60*lsc));
        // Trunk highlight (bark texture)
        g.fillStyle(0x5a3c1c, 0.45);
        g.fillRect(cx - Math.round(4*lsc), base - Math.round(58*lsc), Math.round(4*lsc), Math.round(58*lsc));
        g.fillStyle(0x2a1c0c, 0.5);
        g.fillRect(cx + Math.round(3*lsc), base - Math.round(58*lsc), Math.round(3*lsc), Math.round(58*lsc));

        // Outer canopy — darkest, widest
        g.fillStyle(0x2c4935, 0.92);
        g.fillEllipse(cx - Math.round(4*lsc), base - Math.round(88*lsc), Math.round(110*lsc), Math.round(72*lsc));

        // Mid canopy
        g.fillStyle(0x3c603a, 0.88);
        g.fillEllipse(cx + Math.round(6*lsc), base - Math.round(98*lsc), Math.round(88*lsc), Math.round(60*lsc));

        // Side bulges — natural irregular canopy
        g.fillStyle(0x145c14, 0.82);
        g.fillEllipse(cx - Math.round(38*lsc), base - Math.round(78*lsc), Math.round(52*lsc), Math.round(42*lsc));
        g.fillEllipse(cx + Math.round(36*lsc), base - Math.round(74*lsc), Math.round(48*lsc), Math.round(40*lsc));

        // Inner canopy — brighter, top
        g.fillStyle(0x2a8e2a, 0.85);
        g.fillEllipse(cx - Math.round(2*lsc), base - Math.round(108*lsc), Math.round(65*lsc), Math.round(46*lsc));

        // Top highlight — sunlit crown
        g.fillStyle(0x44b844, 0.60);
        g.fillEllipse(cx + Math.round(8*lsc), base - Math.round(118*lsc), Math.round(38*lsc), Math.round(26*lsc));
        g.fillStyle(0x66d466, 0.30);
        g.fillEllipse(cx + Math.round(10*lsc), base - Math.round(124*lsc), Math.round(20*lsc), Math.round(14*lsc));
        break;
      }

      case 'banyan_tree': {
        const bseed = (tx * 613 + ty * 397) % 100;
        const bsc   = 0.90 + bseed / 160; // 0.90–1.53

        // Ground shadow — very wide, flat (low canopy)
        g.fillStyle(0x000000, 0.26);
        g.fillEllipse(cx + Math.round(14*bsc), base + Math.round(10*bsc), Math.round(160*bsc), Math.round(52*bsc));

        // Aerial roots — thin hanging columns from canopy edges
        const aerialRoots = [
          { ox: -52, topY: -50, groundY: 0 },
          { ox: -38, topY: -60, groundY: 0 },
          { ox:  40, topY: -52, groundY: 0 },
          { ox:  55, topY: -48, groundY: 0 },
          { ox: -18, topY: -65, groundY: 0 },
          { ox:  22, topY: -62, groundY: 0 },
        ];
        for (const r of aerialRoots) {
          const rx = cx + Math.round(r.ox * bsc);
          g.lineStyle(Math.round(2*bsc), 0x5a3e1a, 0.75);
          g.lineBetween(rx, base + Math.round(r.topY * bsc), rx + Math.round(3*bsc), base - 2);
          // Root spread at ground
          g.lineStyle(Math.round(bsc), 0x4a3010, 0.55);
          g.lineBetween(rx, base - 2, rx - Math.round(5*bsc), base + 1);
          g.lineBetween(rx, base - 2, rx + Math.round(4*bsc), base + 1);
        }

        // Main trunks — banyan has multiple merged trunks
        const trunks = [
          { ox: 0, w: 16, h: 48 },
          { ox: -18, w: 9, h: 36 },
          { ox: 20, w: 8, h: 34 },
        ];
        for (const t of trunks) {
          g.fillStyle(0x3a2610);
          g.fillRect(cx + Math.round(t.ox*bsc) - Math.round(t.w/2*bsc), base - Math.round(t.h*bsc), Math.round(t.w*bsc), Math.round(t.h*bsc));
          g.fillStyle(0x5a3c1c, 0.35);
          g.fillRect(cx + Math.round(t.ox*bsc) - Math.round(t.w/4*bsc), base - Math.round(t.h*bsc), Math.round(t.w/4*bsc), Math.round(t.h*bsc));
        }

        // Wide spreading canopy — lower profile than large_tree
        g.fillStyle(0x0d4010, 0.93);
        g.fillEllipse(cx, base - Math.round(70*bsc), Math.round(140*bsc), Math.round(62*bsc));

        g.fillStyle(0x175e17, 0.88);
        g.fillEllipse(cx - Math.round(10*bsc), base - Math.round(78*bsc), Math.round(115*bsc), Math.round(52*bsc));

        // Outer edge lobes — uneven organic shape
        g.fillStyle(0x0f4e12, 0.80);
        g.fillEllipse(cx - Math.round(50*bsc), base - Math.round(62*bsc), Math.round(55*bsc), Math.round(40*bsc));
        g.fillEllipse(cx + Math.round(48*bsc), base - Math.round(58*bsc), Math.round(58*bsc), Math.round(42*bsc));
        g.fillEllipse(cx - Math.round(20*bsc), base - Math.round(84*bsc), Math.round(50*bsc), Math.round(36*bsc));
        g.fillEllipse(cx + Math.round(25*bsc), base - Math.round(82*bsc), Math.round(46*bsc), Math.round(34*bsc));

        // Inner canopy — brighter mid-zone
        g.fillStyle(0x228022, 0.80);
        g.fillEllipse(cx + Math.round(4*bsc), base - Math.round(84*bsc), Math.round(80*bsc), Math.round(44*bsc));

        // Sunlit top patches
        g.fillStyle(0x38a838, 0.55);
        g.fillEllipse(cx - Math.round(12*bsc), base - Math.round(92*bsc), Math.round(44*bsc), Math.round(28*bsc));
        g.fillEllipse(cx + Math.round(20*bsc), base - Math.round(88*bsc), Math.round(36*bsc), Math.round(22*bsc));
        g.fillStyle(0x54c454, 0.25);
        g.fillEllipse(cx + Math.round(5*bsc), base - Math.round(98*bsc), Math.round(24*bsc), Math.round(16*bsc));

        // Hanging moss threads from canopy edge
        g.lineStyle(1, 0x1a6018, 0.40);
        for (let m = 0; m < 8; m++) {
          const mx = cx + Math.round((-60 + m * 18) * bsc);
          const my = base - Math.round((58 + (m % 3) * 6) * bsc);
          g.lineBetween(mx, my, mx + Math.round(2*bsc), my + Math.round(12*bsc));
        }
        break;
      }
    }
  }

  private drawStructure(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number, fuel?: number) {
    const cx  = tx * TS + TS / 2;
    const base = ty * TS + TS - 2; // ground anchor

    if (drawCamp(g, type, tx * TS, base, TS)) return;
    if (type === 'water_container') {
      // Kokosschale mit Palmenblatt — Regensammler
      const water = fuel ?? 0;
      // Shadow
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(cx, base + 2, 18, 5);
      // Schale (Kokosschale - braun)
      g.fillStyle(0x5c3a1a);
      g.fillEllipse(cx, base - 4, 20, 10);
      g.fillStyle(0x7a4f28);
      g.fillEllipse(cx, base - 6, 18, 7);
      // Palmenblatt (grün, oben)
      g.fillStyle(0x3a7a2a, 0.85);
      g.fillEllipse(cx - 6, base - 10, 10, 4);
      g.fillEllipse(cx + 5, base - 11, 9, 4);
      // Wasser drin (hellblau, wenn gefüllt)
      if (water > 0) {
        g.fillStyle(0x38bdf8, 0.7);
        g.fillEllipse(cx, base - 5, 12, 5);
      }

    } else if (type === 'wooden_shelter') {
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(cx, base + 2, 34, 8);
      g.fillStyle(0x5c3317);
      g.fillRect(cx - 14, base - 18, 28, 18);
      g.fillStyle(0x8b5e3c);
      g.fillRect(cx - 13, base - 20, 26, 16);
      g.fillStyle(0x3d200e);
      g.fillRect(cx - 5, base - 18, 10, 18);
      g.fillStyle(0x6b3a1f);
      g.fillTriangle(cx - 16, base - 20, cx, base - 44, cx + 16, base - 20);
      g.fillStyle(0x8b5e3c, 0.4);
      g.fillTriangle(cx - 12, base - 20, cx, base - 40, cx + 12, base - 20);

    } else if (type === 'workbench') {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(cx, base + 1, 28, 6);
      g.fillStyle(0x8b5e3c);
      g.fillRect(cx - 13, base - 16, 26, 6);
      g.fillStyle(0xaa7a50, 0.7);
      g.fillRect(cx - 12, base - 17, 24, 4);
      g.fillStyle(0x6b3a1f);
      g.fillRect(cx - 12, base - 10, 5, 10);
      g.fillRect(cx + 7,  base - 10, 5, 10);
      g.fillStyle(0xcccccc);
      g.fillRect(cx - 7, base - 20, 2, 5);
      g.fillRect(cx,     base - 21, 2, 5);
      g.fillRect(cx + 5, base - 19, 2, 5);

    } else if (type === 'log_cabin') {
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(cx, base + 2, 36, 9);
      g.fillStyle(0x4a2e0e);
      g.fillRect(cx - 15, base - 22, 30, 22);
      g.fillStyle(0x7a4a1e);
      for (let row = 0; row < 4; row++) {
        g.fillRect(cx - 14, base - 22 + row * 5, 28, 3);
      }
      g.fillStyle(0x2a1000);
      g.fillRect(cx - 5, base - 22, 10, 22);
      g.fillStyle(0x5c2d0a);
      g.fillTriangle(cx - 17, base - 22, cx, base - 50, cx + 17, base - 22);

    } else if (type === 'bed') {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(cx, base + 1, 26, 6);
      g.fillStyle(0x8b5e3c);
      g.fillRect(cx - 12, base - 14, 24, 14);
      g.fillStyle(0xe8d5b0);
      g.fillRect(cx - 10, base - 12, 20, 10);
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(cx - 9, base - 11, 18, 5);
      g.fillStyle(0x8b5e3c);
      g.fillRect(cx - 12, base - 16, 5, 4);
      g.fillRect(cx + 7,  base - 16, 5, 4);

    } else if (type === 'farm_plot') {
      g.fillStyle(0x5a3010);
      g.fillRect(cx - 14, base - 24, 28, 24);
      g.fillStyle(0x7a4820, 0.6);
      for (let row = 0; row < 3; row++) {
        g.fillRect(cx - 13, base - 22 + row * 7, 26, 3);
      }
      g.fillStyle(0x3cb043);
      for (let col = 0; col < 4; col++) {
        g.fillCircle(cx - 10 + col * 7, base - 10, 3);
        g.fillRect(cx - 11 + col * 7, base - 16, 2, 6);
      }

    } else if (type === 'storage_box') {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(cx, base + 1, 24, 6);
      // Box body
      g.fillStyle(0x7a4a1e);
      g.fillRect(cx - 11, base - 16, 22, 16);
      // Wood planks
      g.fillStyle(0x5c3317);
      g.fillRect(cx - 10, base - 15, 20, 3);
      g.fillRect(cx - 10, base - 9, 20, 3);
      // Lid
      g.fillStyle(0x9a6030);
      g.fillRect(cx - 12, base - 18, 24, 4);
      g.fillStyle(0xb87840, 0.5);
      g.fillRect(cx - 11, base - 18, 22, 2);
      // Metal latch
      g.fillStyle(0xaaaaaa);
      g.fillRect(cx - 2, base - 15, 4, 3);
      g.fillStyle(0xdddddd);
      g.fillRect(cx - 1, base - 15, 2, 1);

    } else if (type === 'construction_site') {
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(cx, base + 1, 30, 6);
      // Ground stakes
      g.fillStyle(0x8b5e3c);
      g.fillRect(cx - 13, base - 18, 4, 18);
      g.fillRect(cx + 9,  base - 14, 4, 14);
      // Horizontal beam
      g.fillStyle(0xaa7a50);
      g.fillRect(cx - 13, base - 18, 26, 4);
      // Rope lines
      g.lineStyle(1, 0xd4a85a, 0.8);
      g.lineBetween(cx - 9, base - 14, cx + 9, base - 14);
      g.lineBetween(cx - 9, base - 9, cx + 9, base - 9);
      // Pile of wood/stone on ground
      g.fillStyle(0x6b3a1f);
      g.fillRect(cx - 7, base - 5, 14, 5);
      g.fillStyle(0x9a9a9a, 0.7);
      g.fillEllipse(cx + 3, base - 7, 10, 5);
      // Warning stripes
      g.fillStyle(0xf59e0b, 0.9);
      g.fillRect(cx - 11, base - 20, 22, 4);
      g.fillStyle(0x1a1a1a, 0.7);
      for (let i = 0; i < 5; i++) {
        g.fillRect(cx - 10 + i * 5, base - 20, 2, 4);
      }

    } else if (type === 'furnace') {
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(cx, base + 2, 26, 7);
      g.fillStyle(0x555555);
      g.fillRect(cx - 12, base - 26, 24, 26);
      g.fillStyle(0x444444);
      g.fillRect(cx - 4, base - 30, 8, 6);
      g.fillStyle(0x111111);
      g.fillRect(cx - 7, base - 14, 14, 10);
      g.fillStyle(0xe67e22, 0.85);
      g.fillRect(cx - 5, base - 12, 10, 7);
      g.fillStyle(0xf1c40f, 0.7);
      g.fillRect(cx - 3, base - 11, 6, 5);
      g.fillStyle(0x333333, 0.5);
      g.fillRect(cx - 2, base - 34, 4, 6);
    }
  }

  // ── Player rendering ──────────────────────────────────────────────

  private renderPlayer() {
    const g = this.playerGraphics!;
    if (!g || !this.scene) return;

    const { direction } = usePlayerStore.getState().player;
    const cx = this.playerPx + TS / 2;
    const cy = this.playerPy + TS / 2;

    // ── Awakening pose: liegend (pose=0) → stehend (pose=1) ──────────
    if (useGameStore.getState().isAwakening && this.awakeningPose < 1) {
      this.renderPlayerLying(g, cx, cy, this.awakeningPose);
      this.scene.cameras.main.centerOn(cx, cy);
      return;
    }

    // ── Walk-cycle — 8 frames, sin-based for smooth feel ─────────────
    const f = this.walkFrame; // continuous phase, based on distance walked
    const phase = (f / 8) * Math.PI * 2;
    const stride    = this.isMoving ? Math.sin(phase) : 0;
    const { job, message } = useCraftingStore.getState();
    const carrying = job?.building?.siteId && findSite(job.building.siteId)?.phase === 'carry';
    const working = !this.isMoving && !!job && job.elapsed < job.duration && !message && !carrying && !useGameStore.getState().isPaused;
    const gathering = !this.isMoving && this.scene.time.now < this.gatherPoseUntil;
    const workSwing = working ? Math.sin(this.scene.time.now / 140) * 2 : gathering ? 2 : 0;
    const bob = this.isMoving ? -Math.abs(Math.sin(phase)) : -Math.abs(workSwing) * 0.3;
    const legSwing  = this.isMoving ? stride * 5 : 0;   // front/back leg swing ±5px
    const armSwing  = this.isMoving ? -stride * 4 : workSwing;  // arms opposite to legs

    // Update y-sort depth so player walks behind tall objects
    const tileY = Math.floor(this.playerPy / TS);
    g.setDepth(tileY * 1000 + 3);

    g.clear();

    // ── Shadow ────────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.20);
    g.fillEllipse(cx, cy + 11, 16, 5);

    const side = direction === 'left' || direction === 'right';
    const facingLeft = direction === 'left';

    // ── Legs ──────────────────────────────────────────────────────────
    if (side) {
      // Side view: back leg first (darker), then front leg
      const backLegY  = cy + 6 + bob - legSwing * 0.5;
      const frontLegY = cy + 6 + bob + legSwing * 0.5;

      // Back leg (darker)
      g.fillStyle(0x1e2d3a);
      g.fillRect(cx - 2, backLegY, 4, 7);
      g.fillStyle(0x2a1f14); // shoe
      g.fillEllipse(cx + (facingLeft ? -3 : 2), backLegY + 7, 6, 3);

      // Front leg
      g.fillStyle(0x2c3e50);
      g.fillRect(cx - 2, frontLegY, 4, 7);
      g.fillStyle(0x3a2810); // shoe
      g.fillEllipse(cx + (facingLeft ? -3 : 2), frontLegY + 7, 6, 3);
    } else {
      // Front/back: two legs side by side
      const lLegLen = 7 + Math.round(legSwing * 0.6);
      const rLegLen = 7 - Math.round(legSwing * 0.6);

      g.fillStyle(0x2c3e50);
      g.fillRect(cx - 5, cy + 6 + bob, 4, lLegLen);
      g.fillStyle(0x1a252f);
      g.fillRect(cx + 1, cy + 6 + bob, 4, rLegLen);
      // Feet
      g.fillStyle(0x3a2810);
      g.fillEllipse(cx - 3, cy + 6 + bob + lLegLen, 6, 3);
      g.fillStyle(0x2a1f14);
      g.fillEllipse(cx + 3, cy + 6 + bob + rLegLen, 6, 3);
    }

    // ── Body (shirt — trapezoid: wide shoulders, narrower hips) ───────
    g.fillStyle(0x527c86);
    g.fillTriangle(cx - 6, cy - 2 + bob, cx + 6, cy - 2 + bob, cx + 4, cy + 7 + bob);
    g.fillTriangle(cx - 6, cy - 2 + bob, cx + 4, cy + 7 + bob, cx - 4, cy + 7 + bob);
    // Shirt crease / collar shadow
    g.fillStyle(0x345762, 0.5);
    g.fillRect(cx - 1, cy - 1 + bob, 2, 7);
    // Shoulder highlights
    g.fillStyle(0x8faeb0, 0.4);
    g.fillRect(cx - 5, cy - 2 + bob, 2, 3);
    if (!side) g.fillRect(cx + 3, cy - 2 + bob, 2, 3);

    // ── Arms ──────────────────────────────────────────────────────────
    const skinColor = 0xf0c88a;
    const skinDark  = 0xd4a870;
    if (side) {
      // One visible arm (front)
      const ax = facingLeft ? cx - 7 : cx + 4;
      g.fillStyle(skinColor);
      g.fillRect(ax, cy - 1 + bob + armSwing, 3, 6);
      // Hand
      g.fillStyle(skinDark);
      g.fillCircle(ax + 1, cy + 5 + bob + armSwing, 2);
    } else {
      // Both arms visible
      g.fillStyle(skinColor);
      g.fillRect(cx - 8, cy - 1 + bob + armSwing,  3, 6);
      g.fillRect(cx + 5, cy - 1 + bob - armSwing,  3, 6);
      // Hands
      g.fillStyle(skinDark);
      g.fillCircle(cx - 7, cy + 5 + bob + armSwing, 2);
      g.fillCircle(cx + 6, cy + 5 + bob - armSwing, 2);
    }

    // ── Neck ──────────────────────────────────────────────────────────
    g.fillStyle(skinColor);
    g.fillRect(cx - 1, cy - 4 + bob, 3, 4);

    // ── Head ──────────────────────────────────────────────────────────
    g.fillStyle(skinColor);
    g.fillCircle(cx, cy - 7 + bob, 6);

    // Ear (side view only)
    if (side) {
      const earX = facingLeft ? cx + 4 : cx - 4;
      g.fillStyle(skinDark);
      g.fillCircle(earX, cy - 7 + bob, 2);
    }

    // ── Hair ──────────────────────────────────────────────────────────
    g.fillStyle(0x5d3e2a);
    g.fillCircle(cx, cy - 11 + bob, 5);
    g.fillRect(cx - 5, cy - 13 + bob, 11, 5);
    if (direction !== 'up') {
      // Front fringe
      g.fillRect(cx - 5, cy - 10 + bob, 4, 3);
      if (side) {
        // Side fringe hangs toward face
        const fringeX = facingLeft ? cx - 4 : cx + 1;
        g.fillRect(fringeX, cy - 10 + bob, 3, 4);
      }
    }

    // ── Face ──────────────────────────────────────────────────────────
    if (direction !== 'up') {
      g.fillStyle(0x2c1810);
      if (direction === 'left') {
        g.fillCircle(cx - 3, cy - 7 + bob, 1.2);
        // Nose hint
        g.fillStyle(skinDark);
        g.fillRect(cx - 6, cy - 8 + bob, 1, 2);
        g.fillStyle(0xc07060, 0.8);
        g.fillRect(cx - 5, cy - 5 + bob, 3, 1);
      } else if (direction === 'right') {
        g.fillCircle(cx + 3, cy - 7 + bob, 1.2);
        g.fillStyle(skinDark);
        g.fillRect(cx + 5, cy - 8 + bob, 1, 2);
        g.fillStyle(0xc07060, 0.8);
        g.fillRect(cx + 2, cy - 5 + bob, 3, 1);
      } else {
        // Front: two eyes + mouth
        g.fillCircle(cx - 2, cy - 7 + bob, 1.2);
        g.fillCircle(cx + 2, cy - 7 + bob, 1.2);
        // Eye whites
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(cx - 2, cy - 7.5 + bob, 0.7);
        g.fillCircle(cx + 2, cy - 7.5 + bob, 0.7);
        g.fillStyle(0xc07060, 0.8);
        g.fillRect(cx - 2, cy - 5 + bob, 4, 1);
      }
    }

    // Camera follow
    this.scene.cameras.main.centerOn(cx, cy);
  }

  // ── Shipwreck rendering ───────────────────────────────────────────
  private renderShipwreck(world: any) {
    const g = this.shipwreckGraphics;
    if (!g || !world.shipwreck) return;

    for (const piece of world.shipwreck as import('../../types').ShipwreckPiece[]) {
      const cx = piece.x * TS + TS / 2;
      const cy = piece.y * TS + TS / 2;
      const s = piece.scale;
      const r = piece.rotation;

      // Rotate helper
      const rotPt = (lx: number, ly: number): [number, number] => {
        const rx = lx * Math.cos(r) - ly * Math.sin(r);
        const ry = lx * Math.sin(r) + ly * Math.cos(r);
        return [cx + rx * s, cy + ry * s];
      };

      // Water shadow under each piece
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(cx + 2, cy + 3, 38 * s, 14 * s);

      switch (piece.type) {
        case 'hull': {
          // Large curved hull section — dark weathered wood
          const wood1 = 0x4a2e12;
          const wood2 = 0x5c3a1a;
          const wood3 = 0x3a2008;
          // Hull body — wide curved plank shape
          g.fillStyle(wood2);
          const [h0x, h0y] = rotPt(-18, -6);
          const [h1x, h1y] = rotPt( 18, -6);
          const [h2x, h2y] = rotPt( 22,  4);
          const [h3x, h3y] = rotPt(-22,  4);
          g.fillTriangle(h0x, h0y, h1x, h1y, h2x, h2y);
          g.fillTriangle(h0x, h0y, h2x, h2y, h3x, h3y);
          // Darker top edge (broken rim)
          g.fillStyle(wood3);
          const [r0x, r0y] = rotPt(-18, -6);
          const [r1x, r1y] = rotPt( 18, -6);
          const [r2x, r2y] = rotPt( 16, -9);
          const [r3x, r3y] = rotPt(-16, -9);
          g.fillTriangle(r0x, r0y, r1x, r1y, r2x, r2y);
          g.fillTriangle(r0x, r0y, r2x, r2y, r3x, r3y);
          // Wood grain lines
          g.lineStyle(1, wood1, 0.6);
          for (let i = -12; i <= 12; i += 6) {
            const [la, lb] = rotPt(i, -8);
            const [lc, ld] = rotPt(i + 1, 5);
            g.beginPath(); g.moveTo(la, lb); g.lineTo(lc, ld); g.strokePath();
          }
          // Copper nails
          g.fillStyle(0x8b6914);
          for (const [nx, ny] of [[-14,-7],[0,-7],[14,-7],[-10,0],[10,0]]) {
            const [px, py] = rotPt(nx, ny);
            g.fillCircle(px, py, 1.2 * s);
          }
          break;
        }
        case 'hull_small': {
          // Smaller broken hull fragment
          g.fillStyle(0x5c3a1a);
          const [a0x,a0y] = rotPt(-12,-4);
          const [a1x,a1y] = rotPt( 12,-4);
          const [a2x,a2y] = rotPt( 10, 5);
          const [a3x,a3y] = rotPt(-10, 5);
          g.fillTriangle(a0x,a0y,a1x,a1y,a2x,a2y);
          g.fillTriangle(a0x,a0y,a2x,a2y,a3x,a3y);
          g.fillStyle(0x3a2008);
          const [b0x,b0y] = rotPt(-12,-4);
          const [b1x,b1y] = rotPt( 12,-4);
          const [b2x,b2y] = rotPt( 10,-7);
          const [b3x,b3y] = rotPt(-10,-7);
          g.fillTriangle(b0x,b0y,b1x,b1y,b2x,b2y);
          g.fillTriangle(b0x,b0y,b2x,b2y,b3x,b3y);
          g.lineStyle(1, 0x4a2e12, 0.5);
          for (let i = -8; i <= 8; i += 5) {
            const [la,lb] = rotPt(i,-6); const [lc,ld] = rotPt(i,4);
            g.beginPath(); g.moveTo(la,lb); g.lineTo(lc,ld); g.strokePath();
          }
          break;
        }
        case 'mast': {
          // Fallen mast — long thin pole, partially submerged
          g.fillStyle(0x6b4423);
          const [m0x,m0y] = rotPt(-26,-3);
          const [m1x,m1y] = rotPt( 26,-3);
          const [m2x,m2y] = rotPt( 26, 3);
          const [m3x,m3y] = rotPt(-26, 3);
          g.fillTriangle(m0x,m0y,m1x,m1y,m2x,m2y);
          g.fillTriangle(m0x,m0y,m2x,m2y,m3x,m3y);
          // Rope remnant
          g.lineStyle(1, 0x8b7355, 0.7);
          const [ra,rb] = rotPt(-10,-2); const [rc,rd] = rotPt(8,6);
          g.beginPath(); g.moveTo(ra,rb); g.lineTo(rc,rd); g.strokePath();
          // Cross spar
          g.fillStyle(0x5c3a1a);
          const angle2 = r + Math.PI / 2;
          const cos2 = Math.cos(angle2); const sin2 = Math.sin(angle2);
          const bx = cx + (-10) * Math.cos(r) * s;
          const by = cy + (-10) * Math.sin(r) * s;
          g.fillRect(bx - 2 * s, by - 10 * s, 4 * s, 20 * s);
          void cos2; void sin2;
          break;
        }
        case 'plank': {
          // Loose drifting plank
          g.fillStyle(0x7a4f28);
          const [p0x,p0y] = rotPt(-14,-2);
          const [p1x,p1y] = rotPt( 14,-2);
          const [p2x,p2y] = rotPt( 13, 2);
          const [p3x,p3y] = rotPt(-13, 2);
          g.fillTriangle(p0x,p0y,p1x,p1y,p2x,p2y);
          g.fillTriangle(p0x,p0y,p2x,p2y,p3x,p3y);
          // Nail holes
          g.fillStyle(0x3a2008);
          for (const [nx,ny] of [[-10,0],[0,0],[10,0]]) {
            const [px,py] = rotPt(nx,ny);
            g.fillCircle(px,py,0.8*s);
          }
          break;
        }
      }
    }
  }

  // ── Lying-down / rising animation ────────────────────────────────
  private renderPlayerLying(g: Phaser.GameObjects.Graphics, cx: number, cy: number, pose: number) {
    g.clear();

    // pose=0: lying flat (rotation=90°), pose=1: standing (rotation=0°)
    // We simulate rotation by lerping coordinates
    const angle = (1 - pose) * (Math.PI / 2); // 90° → 0°
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Helper: rotate a point around cx,cy and draw offset
    const rot = (lx: number, ly: number): [number, number] => {
      const rx = lx * cosA - ly * sinA;
      const ry = lx * sinA + ly * cosA;
      return [cx + rx, cy + ry];
    };

    // Shadow — stretches as player rises
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx + (1 - pose) * 4, cy + 10 * pose + 6 * (1 - pose),
      18 + (1 - pose) * 8, 7 - (1 - pose) * 3);

    // Legs
    g.fillStyle(0x2c3e50);
    const [lx1, ly1] = rot(-3, 8);
    const [lx2, ly2] = rot(2,  8);
    const [lx3, ly3] = rot(-3, 14);
    const [lx4, ly4] = rot(2,  14);
    g.fillTriangle(lx1, ly1, lx2, ly2, lx3, ly3);
    g.fillStyle(0x1a252f);
    g.fillTriangle(lx2, ly2, lx3, ly3, lx4, ly4);

    // Body
    g.fillStyle(0x2471a3);
    const [bx1, by1] = rot(-5, -1);
    const [bx2, by2] = rot( 5, -1);
    const [bx3, by3] = rot( 5,  8);
    const [bx4, by4] = rot(-5,  8);
    g.fillTriangle(bx1, by1, bx2, by2, bx3, by3);
    g.fillTriangle(bx1, by1, bx3, by3, bx4, by4);

    // Arms
    g.fillStyle(0xfde3a7);
    const [ax1, ay1] = rot(-8, 0);
    const [ax2, ay2] = rot(-5, 0);
    const [ax3, ay3] = rot(-8, 6);
    const [ax4, ay4] = rot(-5, 6);
    g.fillTriangle(ax1, ay1, ax2, ay2, ax3, ay3);
    g.fillTriangle(ax2, ay2, ax3, ay3, ax4, ay4);
    const [ax5, ay5] = rot(5, 0);
    const [ax6, ay6] = rot(8, 0);
    const [ax7, ay7] = rot(5, 6);
    const [ax8, ay8] = rot(8, 6);
    g.fillTriangle(ax5, ay5, ax6, ay6, ax7, ay7);
    g.fillTriangle(ax6, ay6, ax7, ay7, ax8, ay8);

    // Head
    g.fillStyle(0xfde3a7);
    const [hx, hy] = rot(0, -7);
    g.fillCircle(hx, hy, 6);

    // Hair
    g.fillStyle(0x5d3e2a);
    g.fillCircle(hx, hy - 3, 5);

    // Closed eyes (unconscious / waking) — only show when nearly lying
    if (pose < 0.6) {
      g.fillStyle(0x2c1810);
      const [ex1, ey1] = rot(-2, -8);
      const [ex2, ey2] = rot( 2, -8);
      g.fillRect(ex1 - 2, ey1 - 0.5, 3, 1);
      g.fillRect(ex2 - 2, ey2 - 0.5, 3, 1);
    }
  }

  // ── Fog of War ────────────────────────────────────────────────────

  private markExplored(px: number, py: number, radius: number) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx >= 0 && nx < WORLD_CONFIG.width && ny >= 0 && ny < WORLD_CONFIG.height) {
            this.exploredTiles[ny][nx] = true;
          }
        }
      }
    }
  }

  private updateFog(px: number, py: number, sightRadius: number) {
    const g = this.fogGraphics!;
    if (!g || !this.scene) return;

    g.clear();

    const cam = this.scene.cameras.main;
    const tx0 = Math.max(0, Math.floor(cam.worldView.x / TS) - 1);
    const ty0 = Math.max(0, Math.floor(cam.worldView.y / TS) - 1);
    const tx1 = Math.min(WORLD_CONFIG.width - 1, Math.ceil((cam.worldView.x + cam.worldView.width) / TS) + 1);
    const ty1 = Math.min(WORLD_CONFIG.height - 1, Math.ceil((cam.worldView.y + cam.worldView.height) / TS) + 1);

    const r2 = sightRadius * sightRadius;
    const cfR2 = CAMPFIRE_SIGHT * CAMPFIRE_SIGHT;
    const litCampfires = (useWorldStore.getState().world?.structures ?? [])
      .filter(s => s.type === 'campfire' && (s.fuel ?? 0) > 0);

    const isVisible = (tx: number, ty: number): boolean => {
      const dx = tx - px, dy = ty - py;
      if (dx * dx + dy * dy <= r2) return true;
      return litCampfires.some(cf => {
        const cdx = tx - cf.x, cdy = ty - cf.y;
        return cdx * cdx + cdy * cdy <= cfR2;
      });
    };

    // Cover screen margins outside the tile range (world edges, camera overshoot)
    g.fillStyle(0x000000, 1);
    const worldPxW = WORLD_CONFIG.width  * TS;
    const worldPxH = WORLD_CONFIG.height * TS;
    // Left/right/top/bottom strips beyond the world
    if (cam.worldView.x < 0)
      g.fillRect(cam.worldView.x, cam.worldView.y, -cam.worldView.x, cam.worldView.height);
    if (cam.worldView.right > worldPxW)
      g.fillRect(worldPxW, cam.worldView.y, cam.worldView.right - worldPxW, cam.worldView.height);
    if (cam.worldView.y < 0)
      g.fillRect(cam.worldView.x, cam.worldView.y, cam.worldView.width, -cam.worldView.y);
    if (cam.worldView.bottom > worldPxH)
      g.fillRect(cam.worldView.x, worldPxH, cam.worldView.width, cam.worldView.bottom - worldPxH);

    // Draw dark segments row by row — merges contiguous dark tiles into one
    // fillRect, keeping total draw calls to ~40 instead of ~700.
    g.fillStyle(0x000000, 1);
    for (let ty = ty0; ty <= ty1; ty++) {
      let segStart = -1;
      for (let tx = tx0; tx <= tx1; tx++) {
        const dark = !isVisible(tx, ty);
        if (dark && segStart === -1) {
          segStart = tx;
        } else if (!dark && segStart !== -1) {
          g.fillRect(segStart * TS, ty * TS, (tx - segStart) * TS, TS);
          segStart = -1;
        }
      }
      // Close any segment still open at the right edge of the viewport
      if (segStart !== -1) {
        g.fillRect(segStart * TS, ty * TS, (tx1 + 1 - segStart) * TS, TS);
      }
    }
  }

  // ── Day/Night overlay ─────────────────────────────────────────────

  private updateFire() {
    const fg = this.fireGraphics;
    if (!fg || !this.scene) return;
    fg.clear();

    const campfires = useWorldStore.getState().world?.structures.filter(
      s => s.type === 'campfire'
    ) ?? [];

    // Warmth glow circles — drawn at depth 1, behind all objects
    const wg = this.warmthGraphics;
    if (wg) {
      wg.clear();
      const t2 = Date.now();
      const pulse = 0.93 + Math.sin(t2 / 1400) * 0.07;
      const R = 5 * TS * pulse; // 5-tile radius
      for (const cf of campfires) {
        if ((cf.fuel ?? 0) <= 0 || !this.isInViewport(cf.x * TS, cf.y * TS, 6 * TS)) continue;
        const cx = cf.x * TS + TS / 2;
        const cy = cf.y * TS + TS / 2;
        wg.fillStyle(0xff6600, 0.055); wg.fillEllipse(cx, cy, R * 2,   R * 1.30);
        wg.fillStyle(0xff8800, 0.075); wg.fillEllipse(cx, cy, R * 1.3, R * 0.85);
        wg.fillStyle(0xffaa00, 0.100); wg.fillEllipse(cx, cy, R * 0.7, R * 0.45);
      }
    }

    if (campfires.length === 0) return;

    const cam = this.scene.cameras.main;
    const t = Date.now();

    for (const cf of campfires) {
      const wx = cf.x * TS + TS / 2;
      const wy = cf.y * TS + TS - 6;

      // Cull off-screen
      const sx = wx - cam.scrollX;
      const sy = wy - cam.scrollY;
      if (sx < -80 || sx > this.game!.scale.width + 80 || sy < -80 || sy > this.game!.scale.height + 80) continue;

      const hasFuel = (cf.fuel ?? 0) > 0;

      if (hasFuel) {
        // === BURNING: animated flame tongues + sparks ===
        const f1 = Math.sin(t / 120 + cf.x) * 0.5 + 0.5;      // fast flicker
        const f2 = Math.sin(t / 200 + cf.y * 2) * 0.5 + 0.5;   // slow sway
        const f3 = Math.sin(t / 80  + cf.x * 3) * 0.5 + 0.5;   // very fast

        // Outer flame (orange)
        const h1 = 14 + 5 * f1;
        const w1 = 7  + 2 * f2;
        fg.fillStyle(0xff6600, 0.85);
        fg.fillEllipse(wx - 2 + f2 * 3, wy - h1 / 2, w1, h1);
        fg.fillEllipse(wx + 3 - f1 * 3, wy - h1 / 2 + 2, w1 - 2, h1 - 3);

        // Mid flame (bright orange)
        const h2 = 10 + 4 * f2;
        fg.fillStyle(0xff9900, 0.90);
        fg.fillEllipse(wx + f3 * 2 - 1, wy - h2 / 2 - 2, 6, h2);

        // Inner flame (yellow)
        const h3 = 7 + 3 * f3;
        fg.fillStyle(0xffdd00, 0.95);
        fg.fillEllipse(wx + f1 * 2 - 1, wy - h3 / 2 - 4, 4, h3);

        // Hot core (white-yellow)
        fg.fillStyle(0xfff5aa, 0.8);
        fg.fillEllipse(wx, wy - 8, 3, 5 + f1 * 2);

        // Sparks — 4 particles at different phases
        for (let i = 0; i < 4; i++) {
          const phase = (t / 600 + i * 0.25) % 1;         // 0→1 rising cycle
          const sparkX = wx + Math.sin(t / 300 + i * 1.8) * 5;
          const sparkY = wy - 8 - phase * 18;              // rises 18px
          const sparkAlpha = phase < 0.6 ? 0.9 : (1 - phase) / 0.4 * 0.9; // fade out top
          fg.fillStyle(0xffaa00, sparkAlpha);
          fg.fillCircle(sparkX, sparkY, 1.2 - phase * 0.8);
        }

        // Smoke wisps (grey, rising slow)
        for (let i = 0; i < 2; i++) {
          const phase = (t / 1200 + i * 0.5) % 1;
          const smokeX = wx + Math.sin(t / 800 + i * 2) * 4;
          const smokeY = wy - 20 - phase * 14;
          const smokeAlpha = phase < 0.4 ? phase / 0.4 * 0.18 : (1 - phase) / 0.6 * 0.18;
          fg.fillStyle(0xaaaaaa, smokeAlpha);
          fg.fillCircle(smokeX, smokeY, 2 + phase * 3);
        }

        // Steam when raining on burning fire
        if (this.isRaining) {
          for (let i = 0; i < 3; i++) {
            const phase = (t / 700 + i * 0.33) % 1;
            const sx2 = wx + Math.sin(t / 400 + i * 2.1) * 5;
            const sy2 = wy - 12 - phase * 20;
            const sa = phase < 0.3 ? phase / 0.3 * 0.35 : (1 - phase) / 0.7 * 0.35;
            fg.fillStyle(0xccddff, sa);
            fg.fillCircle(sx2, sy2, 2.5 + phase * 3);
          }
        }

      }
    }
  }

  private checkFoodDecay(elapsedTime: number) {
    const { player } = usePlayerStore.getState();
    const items = player.inventory.items;
    const spoiled: string[] = [];

    for (const item of items) {
      if (item.addedAt === undefined) continue;
      const spoilTime = FOOD_SPOIL_TIME[item.resourceId];
      if (!spoilTime) continue;
      if (elapsedTime - item.addedAt >= spoilTime) {
        spoiled.push(item.resourceId);
      }
    }

    if (spoiled.length > 0) {
      for (const id of spoiled) {
        usePlayerStore.getState().removeResource(id, 999);
      }
      const names = [...new Set(spoiled.map(id => FOOD_ITEM_NAMES[id] ?? id))].join(', ');
      import('../../store/notificationStore').then(({ useNotificationStore }) => {
        useNotificationStore.getState().addNotification(`${names} ist verdorben! 🤢`, 'levelup');
      });
    }
  }

  // Fatigue stage — drives all fatigue-based maluses
  // Thresholds match the 6-tier design (0-100 scale)
  private getFatigueStage(fatigue: number): 0 | 1 | 2 | 3 | 4 | 5 {
    if (fatigue < 20) return 0; // Ausgeruht
    if (fatigue < 45) return 1; // Müde
    if (fatigue < 65) return 2; // Erschöpft
    if (fatigue < 80) return 3; // Übermüdet
    if (fatigue < 95) return 4; // Sekundenschlaf
    return 5;                   // Kollaps
  }

  // Returns 0 = full day, 1 = full night, with plateaus
  // 05–08h: sunrise (1→0), 08–17h: day (0), 17–22h: sunset (0→1), 22–05h: night (1)
  private getNightFactor(elapsedMs: number): number {
    const hour = ((elapsedMs % DAY_DURATION_MS) / DAY_DURATION_MS) * 24;
    if (hour >= 8 && hour < 17) return 0;                                   // day plateau
    if (hour >= 22 || hour < 5) return 1;                                   // night plateau
    if (hour >= 5 && hour < 8)  return 1 - (hour - 5) / 3;                 // sunrise
    return (hour - 17) / 5;                                                 // sunset
  }

  private updateDayNight(elapsedMs: number) {
    if (!this.dayNightRect || !this.lightGraphics || !this.game) return;

    const alpha = 0.65 * this.getNightFactor(elapsedMs);

    // Just set alpha on the pre-existing Rectangle — no redraw
    this.dayNightRect.setAlpha(alpha);

    // Light glow circles — only drawn when it's actually dark
    const lg = this.lightGraphics;
    if (alpha > 0.05) {
      const cam = this.scene?.cameras?.main;
      if (!cam) return;

      lg.clear();

      // Campfire warm glow — ADD blend, scales with darkness, warm amber tones
      const campfires = useWorldStore.getState().world?.structures.filter(
        s => s.type === 'campfire' && (s.fuel ?? 0) > 0
      ) ?? [];
      for (const cf of campfires) {
        const sx = cf.x * TS + TS / 2 - cam.scrollX;
        const sy = cf.y * TS + TS / 2 - cam.scrollY;
        if (sx < -300 || sx > this.game.scale.width + 300 || sy < -300 || sy > this.game.scale.height + 300) continue;
        const r = CAMPFIRE_SIGHT * TS;
        const f = Math.sin(Date.now() / 300 + cf.x) * 0.03;
        // Many thin layers for smooth gradient, all low alpha
        const steps = 12;
        for (let i = steps; i >= 1; i--) {
          const t = i / steps;                          // 1.0 = outer, 0.08 = inner
          const layerR = r * (0.15 + t * 0.95) + f * 8;
          const layerAlpha = alpha * (1 - t) * 0.30;  // outer nearly invisible, inner subtle
          const col = t > 0.6 ? 0x6b1a00               // outer: deep red-brown
                    : t > 0.3 ? 0xcc3300               // mid: dark orange
                    :           0xff6600;               // inner: orange (stays warm, not yellow)
          lg.fillStyle(col, layerAlpha);
          lg.fillCircle(sx, sy, layerR);
        }
      }

      // Torch light — same gradient as campfire, 4 tiles radius
      const { equipment: eqp } = usePlayerStore.getState().player;
      const hasTorch = eqp?.leftHand?.resourceId === 'torch' || eqp?.rightHand?.resourceId === 'torch';
      if (hasTorch && alpha > 0.1) {
        const { x, y } = usePlayerStore.getState().player;
        const sx = x * TS + TS / 2 - cam.scrollX;
        const sy = y * TS + TS / 2 - cam.scrollY;
        const r = 4 * TS;
        const f = Math.sin(Date.now() / 280) * 0.03;
        const steps = 12;
        for (let i = steps; i >= 1; i--) {
          const t = i / steps;
          const layerR = r * (0.15 + t * 0.95) + f * 8;
          const layerAlpha = alpha * (1 - t) * 0.30;
          const col = t > 0.6 ? 0x6b1a00 : t > 0.3 ? 0xcc3300 : 0xff6600;
          lg.fillStyle(col, layerAlpha);
          lg.fillCircle(sx, sy, layerR);
        }
      }

    } else {
      lg.clear();
    }
  }

  getSightRadius(elapsedMs: number): number {
    const nightFactor = this.getNightFactor(elapsedMs);
    const base = Math.round(SIGHT_NIGHT + (SIGHT_DAY - SIGHT_NIGHT) * (1 - nightFactor));
    const eqp = usePlayerStore.getState().player.equipment;
    const hasTorch = eqp?.leftHand?.resourceId === 'torch' || eqp?.rightHand?.resourceId === 'torch';
    return hasTorch ? base + 3 : base;
  }

  // ── Input ─────────────────────────────────────────────────────────

  private setupInput() {
    if (!this.scene?.input?.keyboard) return;

    this.keys = this.scene.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      UP: Phaser.Input.Keyboard.KeyCodes.UP,
      DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
      LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
      RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      F: Phaser.Input.Keyboard.KeyCodes.F,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    }) as any;

    this.keys.SPACE.on('down', () => { this.keyPressed.space = true; });
    this.keys.E.on('down', () => { this.keyPressed.e = true; });
    this.keys.F.on('down', () => { this.keyPressed.f = true; });
  }

  // ── Game loop ─────────────────────────────────────────────────────

  private isInViewport(px: number, py: number, margin = 3 * TS): boolean {
    if (!this.scene) return false;
    const v = this.scene.cameras.main.worldView;
    return px > v.x - margin && px < v.right + margin &&
           py > v.y - margin && py < v.bottom + margin;
  }

  private updateWorldVisibility() {
    const world = useWorldStore.getState().world;
    if (!this.scene || !world) return;
    // Graphics replay their geometry even offscreen; include overhanging crowns and shadows.
    const margin = 8 * TS;
    for (const resource of world.resources) {
      const treeMargin = resource.type === 'large_tree' || resource.type === 'banyan_tree' ? 11 * TS : margin;
      this.resourceObjects.get(resource.id)?.setVisible(
        this.isInViewport(resource.x * TS, resource.y * TS, treeMargin)
      );
    }
    for (const meta of this.jungleCanopyMeta.values()) {
      meta.g.setVisible(this.isInViewport(meta.tx * TS, meta.ty * TS, margin));
    }
  }

  private onUpdate(rawDelta: number) {
    if (!this.scene) return;
    this.updateWorldVisibility();
    this.updateConstructionArt();

    // Skip frames after tab return to let WebGL context stabilise
    if (this.skipFrames > 0) {
      this.skipFrames--;
      return;
    }

    // Cap delta — prevents catch-up burst after tab switch or system sleep
    const delta = Math.min(rawDelta, 100);
    const buildJob = useCraftingStore.getState().job?.building;
    if (buildJob) {
      const carrying = buildJob.siteId && findSite(buildJob.siteId)?.phase === 'carry';
      const movement = this.keys && ['A', 'D', 'W', 'S', 'LEFT', 'RIGHT', 'UP', 'DOWN'].some(k => this.keys![k].isDown);
      const state = useGameStore.getState();
      if ((!carrying && movement) || this.keyPressed.space || this.keyPressed.e || this.keyPressed.f || state.showSleepMenu || state.isAwakening || state.craftingOpen || state.gatherMenuOpen || state.placementMode) useCraftingStore.getState().cancel();
    }
    this.craftingDelta += delta;
    if (this.craftingDelta >= (buildJob ? 500 : 100)) {
      useCraftingStore.getState().update(this.craftingDelta);
      this.craftingDelta = 0;
    }

    // Placement preview — blocks movement while active
    const pm = useGameStore.getState().placementMode;
    if (pm) {
      this.updatePlacementPreview(pm.recipeId);
      return; // no movement/interaction while placing
    }
    if (this.placementGraphics) this.placementGraphics.clear();

    this.updateAwakening(delta);
    const awakening = useGameStore.getState().isAwakening;

    // Gameplay only when not awakening
    if (!awakening) {
      this.updateCrabs(delta);
      this.updateTurtles(delta);
      this.updateBoars(delta);
      this.updateLizards(delta);
      this.updateParrots(delta);
      this.updateSeagulls(delta);
      this.updateButterflies(delta);
      this.updateRats(delta);
      this.updateSpearLunge(delta);
      this.updateFatigueEffects(delta);
      this.updatePlayerMovement(delta);
    }

    this.gameLoop.update(delta);
    const tick = this.gameLoop.isTickReady();

    if (!awakening) {
      if (!useGameStore.getState().craftingOpen) {
        this.gatherResource();
        this.interactStructure();
      } else {
        this.keyPressed.space = false;
        this.keyPressed.e = false;
        this.keyPressed.f = false;
      }
      if (tick) {
        this.onGameTick();
        this.updateFishing(delta);
        this.updateFarmPlots(delta);
      }
      this.updateHover();
    }

    // Rain animation
    if (this.isRaining) this.updateRain(delta);

    // Always render
    this.renderPlayer();
    const elapsed = useGameStore.getState().elapsedTime;
    this.updateDayNight(elapsed);
    if (!awakening) this.updateFire();

    // Tiles redraw
    if (this.scene && this.cachedWorld) {
      const cam = this.scene.cameras.main;
      const curTx = Math.floor(cam.worldView.x / TS);
      const curTy = Math.floor(cam.worldView.y / TS);
      if (curTx !== this.lastTileViewTx || curTy !== this.lastTileViewTy) {
        this.renderVisibleTiles();
      }
    }

    // Fog — always runs, uses awakening sight override during sequence
    {
      const { x, y } = usePlayerStore.getState().player;
      const overrideSight = this.awakeningOverrideSight();
      const sight = overrideSight !== null ? overrideSight : this.getSightRadius(elapsed);
      if (sight > 0 && (tick || overrideSight !== null)) this.markExplored(x, y, sight);
      this.updateFog(x, y, sight);
    }
  }

  // ── Weapon click handler ──────────────────────────────────────────
  private handleWeaponClick(wx: number, wy: number) {
    if (useGameStore.getState().isPaused) return;

    const { player, addToInventory } = usePlayerStore.getState();
    const eq = player.equipment;
    const handIds = [eq?.leftHand?.resourceId, eq?.rightHand?.resourceId].filter(Boolean) as string[];
    const hasKnife = handIds.some(id => ['flint_knife','stone_axe','improved_axe','iron_axe'].includes(id));
    const hasSpear = handIds.some(id => id === 'stone_spear');

    const playerCx = this.playerPx + TS / 2;
    const playerCy = this.playerPy + TS / 2;

    // ── Spear melee lunge (2 tiles range) ────────────────────────────
    if (hasSpear) {
      if (this.spearLunge || this.spearCooldown > 0) return; // already lunging / on cooldown
      const dx = wx - playerCx;
      const dy = wy - playerCy;
      const angle = Math.atan2(dy, dx);
      const g = this.scene!.add.graphics().setDepth(playerCy + 3);
      this.spearLunge = { angle, progress: 0, phase: 'out', g, hitTargets: new Set() };
      return;
    }

    // ── Try catch turtle (knife required, melee range ≤2.5 tiles) ────
    const TURTLE_RANGE = 2.5 * TS;
    for (const turtle of [...this.turtles]) {
      const dtx = wx - turtle.px;
      const dty = wy - turtle.py;
      const clickDist  = Math.sqrt(dtx * dtx + dty * dty);
      const playerDist = Math.sqrt((playerCx - turtle.px) ** 2 + (playerCy - turtle.py) ** 2);
      if (clickDist < TS * 1.2 && playerDist < TURTLE_RANGE) {
        if (!hasKnife) {
          this.spawnFloatingText('Benötigt Messer 🔪', player.x, player.y, '#f97316');
          return;
        }
        addToInventory('turtle_meat', 2);
        addToInventory('turtle_shell', 1);
        addToInventory('bone', 1);
        if (Math.random() > 0.5) addToInventory('fat', 1);
        this.spawnFloatingText('🐢 Gefangen! Fleisch ×2 + Panzer + Knochen', Math.floor(turtle.px / TS), Math.floor(turtle.py / TS), '#86efac');
        turtle.g.destroy();
        this.turtles = this.turtles.filter(t => t.id !== turtle.id);
        return;
      }
    }
  }

  // Returns the sight radius override during awakening (0 = not awakening)
  awakeningOverrideSight(): number | null {
    if (!useGameStore.getState().isAwakening) return null;
    const t = this.awakeningTimer;
    // Phase 1+2 (0–4000ms): sight = 0
    if (t < 4000) return 0;
    // Phase 3 (4000–16000ms): sight grows 0 → SIGHT_DAY over 12s
    const p = Math.min(1, (t - 4000) / 12000);
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    return Math.round(eased * SIGHT_DAY);
  }

  private initRainDrops() {
    const W = this.game!.scale.width;
    const H = this.game!.scale.height;
    const cfg = GameManager.RAIN_TYPES[this.rainType];
    this.rainDrops = [];
    for (let i = 0; i < cfg.drops; i++) {
      this.rainDrops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin),
        len:   cfg.lenMin   + Math.random() * (cfg.lenMax   - cfg.lenMin),
      });
    }
  }

  private static readonly RAIN_TYPES: Record<string, {
    drops: number; speedMin: number; speedMax: number;
    lenMin: number; lenMax: number; diagonal: number;
    overlayAlpha: number; soundVol: number;
    fadeTicks: number;
    label: string;
  }> = {
    drizzle:   { drops: 60,  speedMin: 3,  speedMax: 5,  lenMin: 5,  lenMax: 8,  diagonal: 0.1, overlayAlpha: 0.08, soundVol: 0.04, fadeTicks: 200, label: 'Nieselregen' },
    shower:    { drops: 120, speedMin: 5,  speedMax: 8,  lenMin: 7,  lenMax: 12, diagonal: 0.2, overlayAlpha: 0.14, soundVol: 0.08, fadeTicks: 300, label: 'Regenschauer' },
    rain:      { drops: 180, speedMin: 6,  speedMax: 10, lenMin: 8,  lenMax: 14, diagonal: 0.25,overlayAlpha: 0.18, soundVol: 0.12, fadeTicks: 400, label: 'Regen' },
    downpour:  { drops: 300, speedMin: 10, speedMax: 16, lenMin: 12, lenMax: 20, diagonal: 0.4, overlayAlpha: 0.28, soundVol: 0.20, fadeTicks: 150, label: 'Wolkenbruch' },
    storm:     { drops: 260, speedMin: 12, speedMax: 18, lenMin: 14, lenMax: 22, diagonal: 0.5, overlayAlpha: 0.32, soundVol: 0.22, fadeTicks: 200, label: 'Gewitter' },
    long_rain: { drops: 150, speedMin: 5,  speedMax: 8,  lenMin: 8,  lenMax: 13, diagonal: 0.2, overlayAlpha: 0.16, soundVol: 0.10, fadeTicks: 600, label: 'Langer Regen' },
  };

  // ticks per rain type (1 game day = 6000 ticks)
  private static readonly RAIN_DURATIONS: Record<string, [number, number]> = {
    drizzle:   [300,  600],   // 30min–1h game
    shower:    [500,  1000],  // ~1–2h game
    rain:      [1000, 2000],  // ~2–4h game
    downpour:  [250,  500],   // ~30–60min game, intense
    storm:     [800,  1500],  // ~1.5–3h game
    long_rain: [3000, 6000],  // half–full game day
  };

  private pickRainType(): void {
    const types = ['drizzle','shower','rain','downpour','storm','long_rain'] as const;
    const weights = [2, 3, 4, 1, 1, 1]; // drizzle & shower more common
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) { this.rainType = types[i]; break; }
    }
    const [min, max] = GameManager.RAIN_DURATIONS[this.rainType];
    this.rainDuration = min + Math.floor(Math.random() * (max - min));
    this.initRainDrops();
    if (this.rainType === 'storm') {
      this.lightningTimer = 0;
      this.nextLightning = 200 + Math.floor(Math.random() * 400);
    }
  }

  private updateRain(delta: number) {
    const W = this.game!.scale.width;
    const H = this.game!.scale.height;
    const cfg = GameManager.RAIN_TYPES[this.rainType];
    const devRain = useGameStore.getState().devRain;

    // Alpha: instant for dev, faded for natural
    let alpha: number;
    if (devRain) {
      alpha = 1;
    } else {
      const fade = cfg.fadeTicks;
      if (this.rainTimer < fade) {
        alpha = this.rainTimer / fade;
      } else if (this.rainTimer > this.rainDuration - fade) {
        alpha = Math.max(0, (this.rainDuration - this.rainTimer) / fade);
      } else {
        alpha = 1;
      }
      alpha = Math.max(0, Math.min(1, alpha));
    }

    this.rainOverlay?.setAlpha(alpha * cfg.overlayAlpha);

    const g = this.rainGraphics;
    if (!g) return;
    g.clear();
    g.lineStyle(1, 0xadd8e6, alpha * 0.55);

    const cam = this.scene!.cameras.main;
    const dt = delta / 16.67;
    for (const drop of this.rainDrops) {
      drop.y += drop.speed * dt;
      drop.x += drop.speed * cfg.diagonal * dt;
      if (drop.y > H + drop.len) { drop.y = -drop.len; drop.x = Math.random() * W; }
      if (drop.x > W + 10) drop.x -= W + 20;

      // Skip drops that fall under jungle canopy
      const worldX = drop.x + cam.worldView.x;
      const worldY = drop.y + cam.worldView.y;
      const tileKey = `${Math.floor(worldX / TS)},${Math.floor(worldY / TS)}`;
      if (this.jungleCanopyCoveredTiles.has(tileKey)) continue;

      g.beginPath();
      g.moveTo(drop.x, drop.y);
      g.lineTo(drop.x - drop.len * cfg.diagonal, drop.y - drop.len);
      g.strokePath();
    }

    // Lightning for storm
    if (this.rainType === 'storm') this.updateLightning(delta, alpha);

    this.updateRainSound(alpha * cfg.soundVol / 0.12);
  }

  private updateLightning(delta: number, rainAlpha: number) {
    if (rainAlpha < 0.3) return;
    this.lightningTimer += delta;
    if (this.lightningTimer >= this.nextLightning) {
      this.lightningTimer = 0;
      this.nextLightning = 3000 + Math.random() * 8000;
      this.triggerLightning();
    }
    // Fade flash overlay
    const la = this.lightningOverlay?.alpha ?? 0;
    if (la > 0.01) this.lightningOverlay?.setAlpha(la * 0.78);
    else this.lightningOverlay?.setAlpha(0);
    // Fade bolt
    this.lightningBoltTimer -= delta;
    if (this.lightningBoltTimer <= 0) this.lightningBoltGraphics?.clear();
  }

  private triggerLightning() {
    // Screen flash
    this.lightningOverlay?.setAlpha(0.65);

    // Draw zigzag bolt
    const W = this.game!.scale.width;
    const H = this.game!.scale.height;
    const g = this.lightningBoltGraphics;
    if (g) {
      g.clear();
      g.lineStyle(2, 0xeeeeff, 0.9);
      const startX = W * 0.2 + Math.random() * W * 0.6;
      let x = startX;
      let y = 0;
      const segments = 8 + Math.floor(Math.random() * 6);
      const segH = (H * 0.7) / segments;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < segments; i++) {
        x += (Math.random() - 0.5) * 80;
        y += segH;
        g.lineTo(x, y);
      }
      g.strokePath();
      // Bright glow layer
      g.lineStyle(5, 0xffffff, 0.25);
      x = startX; y = 0;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < segments; i++) {
        x += (Math.random() - 0.5) * 80;
        y += segH;
        g.lineTo(x, y);
      }
      g.strokePath();
    }
    this.lightningBoltTimer = 120; // visible for ~120ms

    // Thunder after distance-based delay
    const delay = 300 + Math.random() * 1700;
    setTimeout(() => this.playThunder(), delay);
  }

  private playThunder() {
    try {
      const ctx = this.getRainCtx();
      const dur = 1.5 + Math.random() * 1.5;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.pow(1 - i / data.length, 0.3);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 180;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch {}
  }

  private rainAudioCtx: AudioContext | null = null;

  private getRainCtx(): AudioContext {
    if (!this.rainAudioCtx) this.rainAudioCtx = new AudioContext();
    return this.rainAudioCtx;
  }

  private updateRainSound(alpha: number) {
    try {
      const ctx = this.getRainCtx();
      if (alpha > 0.01) {
        if (!this.rainGainNode) {
          // White noise buffer
          const bufLen = ctx.sampleRate * 2;
          const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          // Bandpass filter for rain-like sound
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = 3500;
          filter.Q.value = 0.4;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start();
          this.rainAudioNode = src;
          this.rainGainNode = gain;
        }
        this.rainGainNode.gain.setTargetAtTime(alpha * 0.12, ctx.currentTime, 0.3);
      } else if (this.rainGainNode) {
        this.rainGainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => {
          try { (this.rainAudioNode as AudioBufferSourceNode)?.stop(); } catch {}
          this.rainAudioNode = null;
          this.rainGainNode = null;
        }, 2000);
      }
    } catch {}
  }

  private static readonly FIRE_EXTINGUISHING_TYPES = new Set(['rain', 'downpour', 'storm', 'long_rain']);

  private extinguishCampfires() {
    const worldState = useWorldStore.getState();
    const campfires = worldState.world?.structures.filter(s => s.type === 'campfire' && (s.fuel ?? 0) > 0) ?? [];
    for (const cf of campfires) worldState.updateStructure(cf.id, { fuel: 0 });
    if (campfires.length > 0) {
      const { x, y } = usePlayerStore.getState().player;
      this.spawnFloatingText('🌧️ Lagerfeuer erloschen!', x, y, '#94a3b8');
    }
  }

  private checkRainKnowledge() {
    const { knownMaterials, learnKnowledge } = usePlayerStore.getState();
    const journal = useJournalStore.getState();
    // Always fire first_rain_awake (knows_basic_shelter insight)
    journal.triggerJournalEvent('first_rain_awake');
    for (const grant of RAIN_KNOWLEDGE_GRANTS) {
      if (grant.needsAny.some(m => knownMaterials.includes(m))) {
        learnKnowledge(grant.flag);
      }
    }
    // Additional event when player has palm_leaf (knows_rain_collection insight)
    if (knownMaterials.includes('palm_leaf')) {
      journal.triggerJournalEvent('first_rain_with_leaves');
    }
  }

  private stopRain() {
    this.rainGraphics?.clear();
    this.rainOverlay?.setAlpha(0);
    this.lightningOverlay?.setAlpha(0);
    this.lightningBoltGraphics?.clear();
    this.updateRainSound(0);
  }

  private updateAwakening(delta: number) {
    if (!useGameStore.getState().isAwakening) return;
    this.awakeningTimer += delta;
    const t = this.awakeningTimer;
    const store = useGameStore.getState();

    // Phase 1 (0–2000ms): overlay schwarz, Spieler liegt
    if (t < 2000) {
      this.awakeningOverlay?.setAlpha(1);
      this.awakeningPose = 0;
      store.setAwakeningBlur(0);
      return;
    }

    // Phase 2 (2000–4000ms): overlay blendet schnell aus — Spieler liegt sichtbar
    if (t < 4000) {
      const p = (t - 2000) / 2000;
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this.awakeningOverlay?.setAlpha(Math.max(0, 1 - eased));
      this.awakeningPose = 0;
      store.setAwakeningBlur(0);
      return;
    }

    // Overlay weg ab Phase 3
    if (this.awakeningOverlay) {
      this.awakeningOverlay.setAlpha(0);
      this.awakeningOverlay.destroy();
      this.awakeningOverlay = null;
    }

    // Phase 3 (4000–13000ms): Fog öffnet sich + Blur löst sich auf, Spieler liegt noch
    if (t < 13000) {
      this.awakeningPose = 0;
      const blurP = Math.min(1, (t - 4000) / 9000);
      store.setAwakeningBlur(Math.max(0, 8 * (1 - blurP)));
      return;
    }

    // Phase 4 (13000–16000ms): Spieler steht auf — Welt bereits sichtbar
    if (t < this.AWAKENING_DURATION) {
      const riseP = (t - 13000) / 3000;
      const riseEased = riseP < 0.5 ? 2 * riseP * riseP : 1 - Math.pow(-2 * riseP + 2, 2) / 2;
      this.awakeningPose = riseEased;
      store.setAwakeningBlur(0);
      return;
    }

    // Fertig
    this.awakeningPose = 1;
    store.setAwakeningBlur(0);
    store.setAwakening(false);
  }

  private updateSpearLunge(delta: number) {
    if (this.spearCooldown > 0) this.spearCooldown = Math.max(0, this.spearCooldown - delta);
    const lunge = this.spearLunge;
    if (!lunge || !this.scene) return;

    // Animation: 120ms out, 100ms back
    const OUT_MS  = 120;
    const BACK_MS = 100;
    const LUNGE_RANGE = 2 * TS; // max extension in pixels

    const speed = lunge.phase === 'out' ? 1 / OUT_MS : 1 / BACK_MS;
    lunge.progress += speed * delta;

    if (lunge.phase === 'out' && lunge.progress >= 1) {
      lunge.progress = 1;
      lunge.phase = 'back';
    }
    if (lunge.phase === 'back' && lunge.progress >= 1) {
      lunge.g.destroy();
      this.spearLunge = null;
      this.spearCooldown = 350; // ms before next strike
      return;
    }

    // Ease: quick out, smooth back
    const t = lunge.phase === 'out'
      ? lunge.progress              // linear out
      : 1 - lunge.progress;         // linear back (progress 0→1 means 1→0 extension)
    const ext = t * LUNGE_RANGE;    // current extension from player center

    const playerCx = this.playerPx + TS / 2;
    const playerCy = this.playerPy + TS / 2;
    const cos = Math.cos(lunge.angle);
    const sin = Math.sin(lunge.angle);

    // Tip world position
    const tipX = playerCx + cos * (ext + 8);
    const tipY = playerCy + sin * (ext + 8);

    // Hit detection — only on the way out, each target once
    if (lunge.phase === 'out') {
      const HIT_R = TS * 0.9;
      const { addToInventory } = usePlayerStore.getState();

      for (const turtle of [...this.turtles]) {
        if (lunge.hitTargets.has(turtle.id)) continue;
        if (Math.hypot(tipX - turtle.px, tipY - turtle.py) < HIT_R) {
          lunge.hitTargets.add(turtle.id);
          addToInventory('turtle_meat', 1);
          addToInventory('turtle_shell', 1);
          this.spawnFloatingText('🐢 Getroffen!', Math.floor(turtle.px / TS), Math.floor(turtle.py / TS), '#86efac');
          turtle.g.destroy();
          this.turtles = this.turtles.filter(tt => tt.id !== turtle.id);
        }
      }
      for (const crab of [...this.crabs]) {
        if (lunge.hitTargets.has(crab.id)) continue;
        if (Math.hypot(tipX - crab.px, tipY - crab.py) < HIT_R) {
          lunge.hitTargets.add(crab.id);
          addToInventory('crab_meat', 1);
          this.spawnFloatingText('🦀 Getroffen!', Math.floor(crab.px / TS), Math.floor(crab.py / TS), '#fb923c');
          crab.g.destroy();
          this.crabs = this.crabs.filter(c => c.id !== crab.id);
        }
      }
      for (const boar of [...this.boars]) {
        if (lunge.hitTargets.has(boar.id) || boar.state === 'dead') continue;
        if (Math.hypot(tipX - boar.px, tipY - boar.py) < HIT_R) {
          lunge.hitTargets.add(boar.id);
          const dmg = 25 + Math.random() * 10;
          boar.health = Math.max(0, boar.health - dmg);
          boar.hitFlash = 250;
          this.spawnFloatingText(`-${Math.round(dmg)}`, Math.floor(boar.px / TS), Math.floor(boar.py / TS), '#ff4444');
          if (boar.health <= 0) {
            const drops = 2 + (Math.random() > 0.4 ? 1 : 0);
            const tx = Math.floor(boar.px / TS), ty = Math.floor(boar.py / TS);
            useWorldStore.getState().dropItem('boar_meat', drops, tx, ty);
            useWorldStore.getState().dropItem('bone', 1 + (Math.random() > 0.5 ? 1 : 0), tx, ty);
            {
              useWorldStore.getState().dropItem('hide', 1, tx, ty);
              if (Math.random() > 0.4) useWorldStore.getState().dropItem('fat', 1, tx, ty);
            }
            this.spawnFloatingText('🐗 Erlegt! Fleisch + Knochen', tx, ty - 1, '#f97316');
            useJournalStore.getState().triggerJournalEvent('first_hunt_kill');
            boar.state = 'dead';
            boar.deadAt = Date.now();
            boar.g.clear();
            const g = boar.g;
            g.fillStyle(0x000000, 0.25); g.fillEllipse(boar.px, boar.py + 10, 36, 8);
            g.fillStyle(0x5a2008);       g.fillEllipse(boar.px, boar.py + 4, 34, 14);
            g.fillStyle(0x9a4a20);       g.fillEllipse(boar.px + (boar.facingLeft ? -16 : 16), boar.py + 4, 12, 8);
          }
        }
      }
    }

    // Draw spear extending from player toward cursor
    const g = lunge.g;
    g.clear();
    g.setDepth(Math.floor(this.playerPy / TS) * 1000 + 3);

    // shaft base offset
    const baseX = playerCx - cos * 4;
    const baseY = playerCy - sin * 4;
    const headX  = playerCx + cos * ext;
    const headY  = playerCy + sin * ext;

    // Shaft
    g.lineStyle(3, 0xc8a46e);
    g.beginPath();
    g.moveTo(baseX, baseY);
    g.lineTo(headX, headY);
    g.strokePath();

    // Tip triangle
    const perpX = -sin * 4;
    const perpY  =  cos * 4;
    g.fillStyle(0x94a3b8);
    g.fillTriangle(
      headX + cos * 10, headY + sin * 10,
      headX + perpX,    headY + perpY,
      headX - perpX,    headY - perpY,
    );
    // Tip sheen
    g.fillStyle(0xdde8f0, 0.5);
    g.fillTriangle(
      headX + cos * 10, headY + sin * 10,
      headX + perpX * 0.4, headY + perpY * 0.4,
      headX,            headY,
    );
  }

  // ── Turtles ───────────────────────────────────────────────────────
  private spawnTurtles(world: any) {
    const TURTLE_COUNT = 6;
    // Prefer tiles at beach/water boundary (near edge of island)
    const candidates: { x: number; y: number }[] = [];
    for (let y = 3; y < world.height - 3; y++) {
      for (let x = 3; x < world.width - 3; x++) {
        if (world.tileMap[y]?.[x]?.type !== 'beach') continue;
        const dist = Math.hypot(x - world.spawnX, y - world.spawnY);
        if (dist < 8) continue;
        // Prefer tiles near water
        const hasWaterNeighbor = [[-1,0],[1,0],[0,-1],[0,1]].some(
          ([dx,dy]) => world.tileMap[y+dy]?.[x+dx]?.type === 'water'
        );
        if (hasWaterNeighbor) candidates.push({ x, y });
      }
    }
    // Shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (let i = 0; i < Math.min(TURTLE_COUNT, candidates.length); i++) {
      const { x, y } = candidates[i];
      const px = x * TS + TS / 2;
      const py = y * TS + TS / 2;
      const g = this.scene!.add.graphics().setDepth(y * 1000 + 2);
      this.turtles.push({
        id: `turtle-${i}`,
        px, py,
        targetPx: px, targetPy: py,
        state: 'idle',
        stateTimer: 2000 + Math.random() * 3000,
        facingLeft: Math.random() > 0.5,
        g,
      });
      this.drawTurtle(this.turtles[this.turtles.length - 1]);
    }
  }

  private drawTurtle(turtle: typeof this.turtles[0]) {
    const g = turtle.g;
    g.clear();
    const x = 0, y = 0;
    const hiding = turtle.state === 'hiding';

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(x, y + 10, 28, 7);

    if (hiding) {
      // Shell only — head/legs tucked in
      g.fillStyle(0x2d6e1a);
      g.fillEllipse(x, y - 2, 26, 20);
      g.fillStyle(0x3a8a22, 0.7);
      g.fillEllipse(x, y - 4, 20, 14);
      // Shell pattern
      g.lineStyle(1, 0x1a4a0a, 0.6);
      g.strokeEllipse(x, y - 2, 18, 13);
      g.strokeEllipse(x - 5, y, 8, 7);
      g.strokeEllipse(x + 5, y, 8, 7);
    } else {
      const flip = turtle.facingLeft ? -1 : 1;
      // Legs (4 stubby)
      g.fillStyle(0x4a7a28);
      g.fillEllipse(x - 8,  y + 6, 9, 6);
      g.fillEllipse(x + 8,  y + 6, 9, 6);
      g.fillEllipse(x - 7,  y - 4, 8, 6);
      g.fillEllipse(x + 7,  y - 4, 8, 6);
      // Body / shell
      g.fillStyle(0x2d6e1a);
      g.fillEllipse(x, y, 24, 18);
      g.fillStyle(0x3a8a22);
      g.fillEllipse(x, y - 2, 18, 13);
      // Shell hex pattern
      g.lineStyle(1, 0x1a4a0a, 0.5);
      g.strokeEllipse(x, y - 1, 14, 10);
      g.strokeEllipse(x - 4, y + 1, 7, 6);
      g.strokeEllipse(x + 4, y + 1, 7, 6);
      // Head
      g.fillStyle(0x4a7a28);
      g.fillEllipse(x + flip * 13, y - 1, 10, 8);
      // Eye
      g.fillStyle(0x111111);
      g.fillCircle(x + flip * 15, y - 3, 1.5);
    }

    g.setPosition(turtle.px, turtle.py);
  }

  private updateTurtles(delta: number) {
    if (!this.scene || this.turtles.length === 0) return;
    if (useGameStore.getState().isPaused) return;
    const world = useWorldStore.getState().world;
    if (!world) return;

    const playerCx = this.playerPx + TS / 2;
    const playerCy = this.playerPy + TS / 2;
    const HIDE_RADIUS = 3 * TS;
    const WANDER_SPEED = 12;

    for (const turtle of this.turtles) {
      const dx = playerCx - turtle.px;
      const dy = playerCy - turtle.py;
      const distToPlayer = Math.sqrt(dx * dx + dy * dy);

      // ── State transitions ──────────────────────────────
      if (distToPlayer < HIDE_RADIUS && turtle.state !== 'hiding') {
        turtle.state = 'hiding';
        turtle.stateTimer = 3000 + Math.random() * 2000;
      }
      if (turtle.state === 'hiding' && distToPlayer > HIDE_RADIUS + TS && turtle.stateTimer <= 0) {
        turtle.state = 'idle';
        turtle.stateTimer = 1000 + Math.random() * 2000;
      }

      turtle.stateTimer -= delta;

      if (turtle.state === 'idle' && turtle.stateTimer <= 0) {
        const tx = Math.floor(turtle.px / TS);
        const ty = Math.floor(turtle.py / TS);
        const candidates: { x: number; y: number }[] = [];
        for (let dy2 = -3; dy2 <= 3; dy2++) {
          for (let dx2 = -3; dx2 <= 3; dx2++) {
            const nx = tx + dx2, ny = ty + dy2;
            const t = world.tileMap[ny]?.[nx]?.type;
            if (t === 'beach') candidates.push({ x: nx, y: ny });
          }
        }
        if (candidates.length > 0) {
          const t = candidates[Math.floor(Math.random() * candidates.length)];
          turtle.targetPx = t.x * TS + TS / 2;
          turtle.targetPy = t.y * TS + TS / 2;
          turtle.facingLeft = turtle.targetPx < turtle.px;
          turtle.state = 'wander';
          turtle.stateTimer = 5000 + Math.random() * 5000;
        } else {
          turtle.stateTimer = 1000;
        }
      }

      // ── Movement ───────────────────────────────────────
      if (turtle.state === 'wander') {
        const tdx = turtle.targetPx - turtle.px;
        const tdy = turtle.targetPy - turtle.py;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tdist > 3) {
          const step = WANDER_SPEED * delta / 1000;
          turtle.px += (tdx / tdist) * step;
          turtle.py += (tdy / tdist) * step;
        } else {
          turtle.state = 'idle';
          turtle.stateTimer = 2000 + Math.random() * 4000;
        }
      }

      const tInView = this.isInViewport(turtle.px, turtle.py);
      turtle.g.setVisible(tInView);
      if (tInView) {
        turtle.g.setDepth(Math.floor(turtle.py / TS) * 1000 + 2);
        this.drawTurtle(turtle);
      }
    }
  }

  private spawnCrabs(world: any) {
    const CRAB_COUNT = 10;
    const spawnTiles: { x: number; y: number }[] = [];
    for (let y = 3; y < world.height - 3; y++) {
      for (let x = 3; x < world.width - 3; x++) {
        if (world.tileMap[y]?.[x]?.type === 'beach') {
          const dist = Math.hypot(x - world.spawnX, y - world.spawnY);
          if (dist > 6) spawnTiles.push({ x, y });
        }
      }
    }
    // Shuffle and pick CRAB_COUNT positions
    for (let i = spawnTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spawnTiles[i], spawnTiles[j]] = [spawnTiles[j], spawnTiles[i]];
    }
    const chosen = spawnTiles.slice(0, CRAB_COUNT);
    for (let i = 0; i < chosen.length; i++) {
      const { x, y } = chosen[i];
      const px = x * TS + TS / 2;
      const py = y * TS + TS / 2;
      const g = this.scene!.add.graphics().setDepth(y * 1000 + 2);
      this.crabs.push({
        id: `crab-${i}`,
        px, py,
        targetPx: px, targetPy: py,
        state: 'idle',
        stateTimer: 1000 + Math.random() * 2000,
        facingLeft: Math.random() > 0.5,
        g,
      });
      this.drawCrab(this.crabs[this.crabs.length - 1]);
    }
  }

  private drawCrab(crab: typeof this.crabs[0]) {
    const g = crab.g;
    g.clear();
    const x = 0, y = 0;
    const flip = crab.facingLeft ? -1 : 1;

    // Shadow
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x, y + 7, 18, 5);

    // Body (oval)
    g.fillStyle(0xcc4400);
    g.fillEllipse(x, y, 14, 10);
    g.fillStyle(0xe05500);
    g.fillEllipse(x - 1, y - 1, 10, 7);

    // Eyes
    g.fillStyle(0x111111);
    g.fillCircle(x + flip * 4, y - 3, 1.5);
    g.fillCircle(x + flip * 6, y - 2, 1.5);

    // Claws (front)
    g.lineStyle(2, 0xcc4400);
    g.beginPath();
    g.moveTo(x + flip * 6, y);
    g.lineTo(x + flip * 12, y - 4);
    g.strokePath();
    g.fillStyle(0xcc4400);
    g.fillCircle(x + flip * 12, y - 4, 2.5);

    // Legs (3 pairs)
    g.lineStyle(1.5, 0xaa3300);
    for (let i = 0; i < 3; i++) {
      const lx = x + flip * (1 + i * 3);
      g.beginPath(); g.moveTo(lx, y + 3);
      g.lineTo(lx + flip * 5, y + 9); g.strokePath();
      g.beginPath(); g.moveTo(lx, y + 3);
      g.lineTo(lx - flip * 2, y - 7); g.strokePath();
    }

    g.setPosition(crab.px, crab.py);
  }

  private updateCrabs(delta: number) {
    if (!this.scene || this.crabs.length === 0) return;
    if (useGameStore.getState().isPaused) return;
    const world = useWorldStore.getState().world;
    if (!world) return;

    const gameState = useGameStore.getState();
    const ppx = this.playerPx + TS / 2;
    const ppy = this.playerPy + TS / 2;
    const FLEE_RADIUS  = 4 * TS;
    const CATCH_RADIUS = 1.5 * TS;
    const WANDER_SPEED = 18;
    const FLEE_SPEED   = 55;

    for (const crab of this.crabs) {
      const dx = ppx - crab.px;
      const dy = ppy - crab.py;
      const distToPlayer = Math.sqrt(dx * dx + dy * dy);

      // ── State transitions ──────────────────────────────
      if (distToPlayer < FLEE_RADIUS && crab.state !== 'flee') {
        crab.state = 'flee';
        crab.stateTimer = 2200;
        // Flee target: away from player, 5–8 tiles
        const angle = Math.atan2(crab.py - ppy, crab.px - ppx);
        const dist  = (5 + Math.random() * 3) * TS;
        crab.targetPx = crab.px + Math.cos(angle) * dist;
        crab.targetPy = crab.py + Math.sin(angle) * dist;
        crab.facingLeft = crab.targetPx < crab.px;
      }

      crab.stateTimer -= delta;

      if (crab.state === 'flee' && crab.stateTimer <= 0) {
        crab.state = 'idle';
        crab.stateTimer = 800 + Math.random() * 1500;
      }

      if (crab.state === 'idle' && crab.stateTimer <= 0) {
        // Pick random beach tile nearby as wander target
        const tx = Math.floor(crab.px / TS);
        const ty = Math.floor(crab.py / TS);
        const candidates: { x: number; y: number }[] = [];
        for (let dy2 = -4; dy2 <= 4; dy2++) {
          for (let dx2 = -4; dx2 <= 4; dx2++) {
            const nx = tx + dx2, ny = ty + dy2;
            if (world.tileMap[ny]?.[nx]?.type === 'beach') candidates.push({ x: nx, y: ny });
          }
        }
        if (candidates.length > 0) {
          const t = candidates[Math.floor(Math.random() * candidates.length)];
          crab.targetPx = t.x * TS + TS / 2;
          crab.targetPy = t.y * TS + TS / 2;
          crab.facingLeft = crab.targetPx < crab.px;
          crab.state = 'wander';
          crab.stateTimer = 3000 + Math.random() * 3000;
        } else {
          crab.stateTimer = 500;
        }
      }

      // ── Movement ───────────────────────────────────────
      const speed = crab.state === 'flee' ? FLEE_SPEED : crab.state === 'wander' ? WANDER_SPEED : 0;
      if (speed > 0) {
        const tdx = crab.targetPx - crab.px;
        const tdy = crab.targetPy - crab.py;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tdist > 3) {
          const step = speed * delta / 1000;
          crab.px += (tdx / tdist) * step;
          crab.py += (tdy / tdist) * step;
        } else if (crab.state === 'wander') {
          crab.state = 'idle';
          crab.stateTimer = 1000 + Math.random() * 2000;
        }
      }

      // ── Catch: SPACE within range when not fleeing ─────
      if (gameState.gatherMenuOpen === false && gameState.placementMode === null) {
        if (distToPlayer < CATCH_RADIUS && crab.state !== 'flee') {
          if (this.keyPressed.space) {
            const { addToInventory } = usePlayerStore.getState();
            const freshEq = usePlayerStore.getState().player.equipment;
            const handIds = [freshEq?.leftHand?.resourceId, freshEq?.rightHand?.resourceId].filter(Boolean);
            const hasKnife = handIds.some(id => ['flint_knife','stone_axe','improved_axe','iron_axe'].includes(id as string));
            addToInventory('crab_meat', hasKnife ? 2 : 1);
            this.spawnFloatingText(`🦀 Gefangen!${hasKnife ? ' ×2' : ''}`, Math.floor(crab.px / TS), Math.floor(crab.py / TS), '#f97316');
            crab.g.destroy();
            this.crabs = this.crabs.filter(c => c.id !== crab.id);
            this.keyPressed.space = false;
            continue;
          }
        }
      }

      // ── Redraw ─────────────────────────────────────────
      const cInView = this.isInViewport(crab.px, crab.py);
      crab.g.setVisible(cInView);
      if (cInView) {
        crab.g.setDepth(Math.floor(crab.py / TS) * 1000 + 2);
        this.drawCrab(crab);
      }
    }
  }

  // Width in tiles for structures that occupy more than 1 tile
  private getStructureWidth(recipeId: string): number {
    return buildWidth(recipeId);
  }

  private isValidPlacement(recipeId: string, tx: number, ty: number): boolean {
    return canPlaceBuilding(recipeId, tx, ty, useGameStore.getState().placementMode?.sourceId);
  }

  private updateConstructionArt() {
    const g = this.constructionGraphics;
    if (!g) return;
    const world = useWorldStore.getState().world;
    const sites = world?.constructionSites ?? [];
    const reservations = world?.buildReservations ?? [];
    const visible = sites.filter(s => this.isInViewport(s.x * TS, s.y * TS, TS * 6));
    const key = JSON.stringify([visible.map(s => [s.id, s.phase, Math.floor(s.completed / s.work * 20), s.supplied]), reservations,
      sites.filter(s => s.cargo).map(s => [s.id, s.phase, s.cargoX, s.cargoY, this.isInViewport(s.cargoX! * TS, s.cargoY! * TS)])]);
    if (key === this.constructionArtKey) return;
    this.constructionArtKey = key;
    g.clear(); g.setDepth(2); g.setVisible(true);
    for (const r of reservations) {
      g.lineStyle(1, 0x82aab8, 0.8); g.strokeRect(r.x * TS, r.y * TS, r.width * TS, TS);
    }
    for (const site of visible) {
      drawConstruction(g, site.x * TS, site.y * TS, site.width * TS, TS, site.phase === 'build' ? site.completed / site.work : 0, !site.supplied, site.target);
    }
    for (const site of sites) if (site.cargo && site.phase !== 'build' && this.isInViewport(site.cargoX! * TS, site.cargoY! * TS)) {
      g.fillStyle(0xa58a58); g.fillRoundedRect(site.cargoX! * TS + 5, site.cargoY! * TS + 10, 22, 16, 3);
      g.lineStyle(2, 0x514934); g.lineBetween(site.cargoX! * TS + 16, site.cargoY! * TS + 10, site.cargoX! * TS + 16, site.cargoY! * TS + 26);
    }
  }

  private updatePlacementPreview(recipeId: string) {
    const g = this.placementGraphics;
    if (!g) return;
    g.clear();

    const tx = this.placementTileX;
    const ty = this.placementTileY;
    if (tx < 0 || ty < 0) return;

    const w  = this.getStructureWidth(recipeId);
    const px = tx * TS;
    const py = ty * TS;
    const valid = this.isValidPlacement(recipeId, tx, ty);

    const upgrade = expansionTarget(recipeId);
    if (upgrade) {
      g.lineStyle(1, 0x82aab8, 0.9);
      g.strokeRect(px, py, buildWidth(upgrade) * TS, TS);
    }
    // Fill
    g.fillStyle(valid ? 0x44ff44 : 0xff4444, 0.25);
    g.fillRect(px, py, w * TS, TS);
    // Border
    g.lineStyle(2, valid ? 0x44ff44 : 0xff4444, 0.9);
    g.strokeRect(px, py, w * TS, TS);

    // Ghost structure silhouette
    if (valid) {
      const cx = px + (w * TS) / 2;
      const base = py + TS - 4;
      g.fillStyle(0xffffff, 0.25);
      if (recipeId === 'palm_shelter') {
        g.fillRect(px + 4, py + 4, w * TS - 8, TS - 8);
      } else if (recipeId === 'water_container') {
        // Kokosschale Silhouette
        g.fillStyle(0x5c3a1a, 0.5);
        g.fillEllipse(cx, base - 4, 20, 10);
        g.fillStyle(0x3a7a2a, 0.5);
        g.fillEllipse(cx - 6, base - 10, 10, 4);
        g.fillEllipse(cx + 5, base - 11, 9, 4);
      } else {
        g.fillRect(cx - 14, base - 18, 28, 18);
      }
    }

    // Label: "Esc = Abbrechen"
    // (shown via React overlay — see PlacementOverlay component)
  }

  private confirmPlacement(recipeId: string, tx: number, ty: number) {
    if (!this.isValidPlacement(recipeId, tx, ty)) return;

    const pm = useGameStore.getState().placementMode;
    const reason = planConstruction(recipeId, tx, ty, pm?.sourceId, !!pm?.sourceId);
    useCraftingStore.setState({ message: reason ?? 'Bauplan gesetzt. Direkt daneben Material uebernehmen und Bauen waehlen.' });
    if (!reason) {
      const site = useWorldStore.getState().world?.constructionSites?.at(-1);
      useGameStore.setState({ constructionSelected: site?.id ?? null });
      useGameStore.getState().exitPlacementMode();
      this.placementGraphics?.clear();
    }
  }

  private updateFatigueEffects(delta: number) {
    const fatigue = usePlayerStore.getState().player.stats.fatigue ?? 0;
    const fStage  = this.getFatigueStage(fatigue);

    // ── Stumble (Übermüdet stage 3+): random freeze for 300-500ms ──────
    if (fStage >= 3) {
      if (this.stumbleFreezeMs > 0) {
        this.stumbleFreezeMs -= delta;
      } else {
        this.stumbleTimer += delta;
        if (this.stumbleTimer >= this.nextStumbleAt) {
          this.stumbleTimer      = 0;
          this.stumbleFreezeMs   = 300 + Math.random() * 200;
          // interval shortens the more exhausted the player is
          this.nextStumbleAt     = fStage >= 4
            ? 4000 + Math.random() * 3000
            : 6000 + Math.random() * 6000;
        }
      }
    } else {
      // Reset when fatigue drops below threshold
      this.stumbleFreezeMs = 0;
      this.stumbleTimer    = 0;
      this.nextStumbleAt   = 7000;
    }

    // ── Microsleep flash (Sekundenschlaf stage 4+): blackout every ~8s ─
    if (fStage >= 4 && this.microsleepOverlay) {
      this.microsleepTimer += delta;
      if (this.microsleepTimer >= this.MICROSLEEP_INTERVAL) {
        this.microsleepTimer = 0;
        // Tween: fade to black in 150ms, hold 300ms, fade out in 400ms
        this.scene?.tweens.add({
          targets:  this.microsleepOverlay,
          alpha:    { from: 0, to: 1 },
          duration: 150,
          yoyo:     false,
          onComplete: () => {
            this.scene?.time.delayedCall(300, () => {
              this.scene?.tweens.add({
                targets:  this.microsleepOverlay!,
                alpha:    0,
                duration: 400,
                ease:     'Sine.easeIn',
              });
            });
          },
        });
      }
    } else if (fStage < 4) {
      this.microsleepTimer = 0;
    }
  }

  private updatePlayerMovement(delta: number) {
    if (useGameStore.getState().craftingOpen) { this.isMoving = false; return; }
    if (!this.keys) return;
    const { player, movePlayer, setDirection, updateStats } = usePlayerStore.getState();
    const worldState = useWorldStore.getState();

    const stats = player.stats;
    const hunger  = stats.hunger  ?? 0;
    const thirst  = stats.thirst  ?? 0;
    const fatigue = stats.fatigue ?? 0;
    const stamina = stats.stamina ?? 100;

    // Stumble freeze — block all movement during stumble
    if (this.stumbleFreezeMs > 0) {
      this.isMoving = false;
      this.walkFrame = 0;

      return;
    }

    // Speed maluses — stack multiplicatively
    const fStage = this.getFatigueStage(fatigue);
    let speedMult = 1.0;
    const siteId = useCraftingStore.getState().job?.building?.siteId;
    if (siteId && findSite(siteId)?.phase === 'carry') speedMult *= 0.65;
    if (hunger  > 80) speedMult *= 0.85;
    if (thirst  > 80) speedMult *= 0.85;
    if (fStage === 1) speedMult *= 0.95; // Müde
    if (fStage === 2) speedMult *= 0.90; // Erschöpft
    if (fStage === 3) speedMult *= 0.80; // Übermüdet
    if (fStage === 4) speedMult *= 0.65; // Sekundenschlaf
    if (fStage >= 5)  speedMult  = 0.0;  // Kollaps — Bewegung gesperrt
    if (stamina < 20) speedMult *= 0.80;
    // Weight penalty — linear from 50% load (no penalty) to 100% load (–40% speed)
    const carryWeight = calcWeight(player.inventory.items);
    const loadRatio   = carryWeight / MAX_CARRY_KG;
    if (loadRatio > 0.5) speedMult *= Math.max(0.25, 1.0 - (loadRatio - 0.5) * 0.8);
    // Injury penalty
    if (Date.now() < (player.stats.bleedingUntil ?? 0)) speedMult *= 0.85;
    if (Date.now() < (player.stats.woundedUntil  ?? 0)) speedMult *= 0.90;

    const isSprinting = this.keys.SHIFT.isDown && stamina > 5 && fStage < 5;
    const SPEED = (isSprinting ? 128 : 72) * speedMult; // px/sec
    let vx = 0, vy = 0;

    if (this.keys.A.isDown || this.keys.LEFT.isDown) vx = -1;
    else if (this.keys.D.isDown || this.keys.RIGHT.isDown) vx = 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) vy = -1;
    else if (this.keys.S.isDown || this.keys.DOWN.isDown) vy = 1;

    this.isMoving = vx !== 0 || vy !== 0;
    if (!this.isMoving) {
      this.walkFrame = 0;

      return;
    }

    // Close gather menu on movement
    if (useGameStore.getState().gatherMenuOpen) {
      useGameStore.getState().closeGatherMenu();
    }

    const previousPx = this.playerPx, previousPy = this.playerPy;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    vx *= SPEED * delta / 1000;
    vy *= SPEED * delta / 1000;

    // Try X movement — check tile at leading edge
    const newPx = this.playerPx + vx;
    const edgeTileX = Math.floor((newPx + (vx > 0 ? TS - 1 : 0)) / TS);
    const curTileY = Math.floor((this.playerPy + TS / 2) / TS);
    const curTileXforY = Math.floor((this.playerPx + TS / 2) / TS);
    const playerTile = worldState.getTile(curTileXforY, curTileY);
    const targetXTile = worldState.getTile(edgeTileX, curTileY);
    if (this.canMoveTo(playerTile, targetXTile)) {
      this.playerPx = Math.max(0, Math.min((WORLD_CONFIG.width - 1) * TS, newPx));
    }

    // Try Y movement
    const curTileX = Math.floor((this.playerPx + TS / 2) / TS);
    const newPy = this.playerPy + vy;
    const edgeTileY = Math.floor((newPy + (vy > 0 ? TS - 1 : 0)) / TS);
    const targetYTile = worldState.getTile(curTileX, edgeTileY);
    if (this.canMoveTo(playerTile, targetYTile)) {
      this.playerPy = Math.max(0, Math.min((WORLD_CONFIG.height - 1) * TS, newPy));
    }

    // Sub-tile collision — trees (trunk) + rocks — uses pre-built cache, O(local) not O(all)
    const PLAYER_R = 6;
    const playerCx = this.playerPx + TS / 2;
    const playerCy = this.playerPy + TS / 2;
    const CHECK_PX = (PLAYER_R + 13 + 4) * 2; // max interaction range in px
    for (const b of this.solidBlockers) {
      const dx = playerCx - b.cx;
      if (Math.abs(dx) > CHECK_PX) continue;
      const dy = playerCy - b.cy;
      if (Math.abs(dy) > CHECK_PX) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = PLAYER_R + b.r;
      if (dist < minDist && dist > 0) {
        const push = (minDist - dist) / dist;
        this.playerPx += dx * push;
        this.playerPy += dy * push;
      }
    }

    // Update tile position in store when crossing tile boundary
    const newTileX = Math.floor(this.playerPx / TS);
    const newTileY = Math.floor(this.playerPy / TS);
    if (newTileX !== player.x || newTileY !== player.y) {
      movePlayer(newTileX, newTileY);
      const weightStaminaCost = loadRatio > 0.7 ? (isSprinting ? 1.8 : 0.9) : (isSprinting ? 1.0 : 0.5);
      updateStats({ stamina: Math.max(0, player.stats.stamina - weightStaminaCost) });
    }

    // Footstep sounds — trigger every STEP_DISTANCE px
    const distMoved = Math.hypot(this.playerPx - previousPx, this.playerPy - previousPy);
    this.isMoving = distMoved > 0.01;
    this.walkFrame = this.isMoving ? (this.walkFrame + distMoved / 5) % 8 : 0;
    this.footstepAccum += distMoved;
    if (this.footstepAccum >= this.STEP_DISTANCE) {
      this.footstepAccum = 0;
      const tileType = useWorldStore.getState().getTile(
        Math.floor(this.playerPx / TS),
        Math.floor(this.playerPy / TS)
      )?.type ?? 'grass';
      this.footstepAudio.play(FootstepAudio.surface(tileType));
    }

    // Direction from dominant axis
    if (Math.abs(vx) >= Math.abs(vy)) {
      setDirection(vx < 0 ? 'left' : 'right');
    } else {
      setDirection(vy < 0 ? 'up' : 'down');
    }
  }

  private onGameTick() {
    const { player, updateStats } = usePlayerStore.getState();
    const gameState = useGameStore.getState();

    // Guard against old saves missing stats
    const hunger  = player.stats.hunger  ?? 0;
    const thirst  = player.stats.thirst  ?? 0;
    const stamina = player.stats.stamina ?? 100;
    const health  = player.stats.health  ?? 100;
    const fatigue = player.stats.fatigue ?? 0;

    // ── Hunger drain (1 tick = 100ms, 1 game day = 6000 ticks = 10 min real)
    //    Phase 1: 0→65  over 2 game days (12000 ticks) — human: peckish after hours
    //    Phase 2: 65→100 over 0.5 game days (3000 ticks) — acceleration when seriously hungry
    const HUNGER_P1 = 65 / 12000;
    const HUNGER_P2 = 35 / 3000;
    const newHunger = Math.min(100, hunger + (hunger < 65 ? HUNGER_P1 : HUNGER_P2));

    // ── Thirst drain: 0→100 over 1.5 game days (9000 ticks = 15 min real)
    //    Tropical heat — dehydration is faster than starvation
    const newThirst = Math.min(100, thirst + 100 / 9000);

    // ── Fatigue drain: 0→100 over 1 game day (6000 ticks = 10 min real)
    //    Human needs sleep after ~16h waking → roughly every game day
    const newFatigue = Math.min(100, fatigue + 100 / 6000);

    // ── Stamina regen: fast at rest, very slow while running
    //    Fatigue stage drives a step multiplier (not linear — stage-based feels clearer)
    const fStage = this.getFatigueStage(newFatigue);
    const fatigueMult = [1.0, 0.75, 0.50, 0.25, 0.10, 0.0][fStage];
    const hungerMult  = Math.max(0.25, 1 - newHunger / 100 * 0.75);
    const thirstMult  = Math.max(0.20, 1 - newThirst / 100 * 0.80);
    const regenBase   = this.isMoving ? 0.05 : 0.50;
    // Wound reduces stamina regen
    const now = Date.now();
    const woundMult = (now < (player.stats.woundedUntil ?? 0)) ? 0.5 : 1.0;
    const staminaRegen = regenBase * fatigueMult * hungerMult * thirstMult * woundMult;
    const newStamina = Math.min(100, Math.max(0, stamina + staminaRegen));

    // ── Low-hunger timer: sustained hunger >80% → chronic damage
    this.lowHungerTicks = newHunger > 80 ? (this.lowHungerTicks + 1) : 0;
    const chronicHunger = this.lowHungerTicks > 12000; // 20 real min of serious hunger

    // ── Health drain — dehydration kills fastest, then starvation, then exhaustion
    let healthDrain = 0;
    if (newHunger >= 100)      healthDrain += 0.008;   // starving: ~48 HP/day
    else if (chronicHunger)    healthDrain += 0.003;   // chronic hunger
    if (newThirst >= 100)      healthDrain += 0.025;   // critical dehydration: ~150 HP/day
    else if (newThirst > 90)   healthDrain += 0.015;   // severe dehydration
    else if (newThirst > 75)   healthDrain += 0.005;   // moderate dehydration
    if (fStage >= 5)           healthDrain += 0.008;   // Kollaps: Gesundheitsschaden
    else if (fStage === 4)     healthDrain += 0.003;   // Sekundenschlaf
    // ── Disease drains ────────────────────────────────────────────
    // (now already declared above for woundMult check)
    const poisonedUntil   = player.stats.poisonedUntil   ?? 0;
    const coldUntil       = player.stats.coldUntil       ?? 0;
    const feverUntil      = player.stats.feverUntil      ?? 0;
    const parasitesUntil  = player.stats.parasitesUntil  ?? 0;

    const isPoison    = now < poisonedUntil;
    const isCold      = now < coldUntil;
    const isFever     = now < feverUntil;
    const isParasites = now < parasitesUntil;

    const isBleeding = now < (player.stats.bleedingUntil ?? 0);
    const isWounded  = now < (player.stats.woundedUntil  ?? 0);

    if (isPoison)    healthDrain += DISEASE_DRAIN.poison.health;
    if (isCold)      healthDrain += DISEASE_DRAIN.cold.health;
    if (isFever)     healthDrain += DISEASE_DRAIN.fever.health;
    if (isParasites) healthDrain += DISEASE_DRAIN.parasites.health;
    if (isBleeding)  healthDrain += INJURY_DRAIN.bleeding.health;
    if (isWounded)   healthDrain += INJURY_DRAIN.wounded.health;

    let extraThirst = 0;
    let extraHunger = 0;
    if (isCold)      extraThirst += DISEASE_DRAIN.cold.thirst!;
    if (isFever)     extraThirst += DISEASE_DRAIN.fever.thirst!;
    if (isParasites) extraHunger += DISEASE_DRAIN.parasites.hunger!;

    // ── Cold exposure: rain without shelter → catch cold ─────────
    const hasShelter = useWorldStore.getState().world?.structures.some(s =>
      ['palm_shelter','wooden_shelter','log_cabin'].includes(s.type) &&
      Math.abs(s.x - player.x) <= 2 && Math.abs(s.y - player.y) <= 2
    ) ?? false;

    if (this.isRaining && !hasShelter) {
      this.coldExposureTicks++;
      if (this.coldExposureTicks >= COLD_EXPOSURE_THRESHOLD && !isCold) {
        this.coldExposureTicks = 0;
        const dur = 10 * 60_000;
        usePlayerStore.getState().updateStats({ coldUntil: now + dur });
        import('../../store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().addNotification('Du hast dich erkältet! 🤧', 'levelup');
        });
      }
    } else {
      this.coldExposureTicks = Math.max(0, this.coldExposureTicks - 2);
    }

    // ── Fever: can develop from untreated cold ────────────────────
    if (isCold && !isFever && Math.random() < FEVER_FROM_COLD_CHANCE) {
      usePlayerStore.getState().updateStats({ feverUntil: now + 15 * 60_000 });
      import('../../store/notificationStore').then(({ useNotificationStore }) => {
        useNotificationStore.getState().addNotification('Fieber! Du brauchst Ruhe & Fiebertee 🌡️', 'levelup');
      });
    }

    // ── Temperature system ────────────────────────────────────────────
    const temperature = player.stats.temperature ?? 50;
    const worldSeed   = useWorldStore.getState().world?.seed ?? 0;
    const ambient     = getAmbientTemp(gameState.elapsedTime, worldSeed, this.isRaining);
    const gameHourNow = (gameState.elapsedTime % DAY_DURATION_MS) / DAY_DURATION_MS * 24;

    // Fire warmth: nearest burning campfire within 5 tiles
    const nearFire = useWorldStore.getState().world?.structures.some(
      s => s.type === 'campfire' && (s.fuel ?? 0) > 0 &&
      Math.hypot(s.x - player.x, s.y - player.y) <= 5
    ) ?? false;

    // Tree shade: under large/banyan canopy within 4 tiles, only daytime
    const isDaytime = gameHourNow >= 7 && gameHourNow < 20;
    const inShade = isDaytime && (useWorldStore.getState().world?.resources.some(
      r => (r.type === 'large_tree' || r.type === 'banyan_tree') &&
      Math.hypot(r.x - player.x, r.y - player.y) <= 4
    ) ?? false);

    let targetTemp = ambient;
    if (nearFire)  targetTemp = Math.max(targetTemp, 52) + 20; // fire: at least 72
    if (inShade)   targetTemp = Math.max(0, targetTemp - 12);

    const nudge   = nearFire ? 0.05 : 0.02;
    const newTemp = temperature + Math.sign(targetTemp - temperature) * Math.min(nudge, Math.abs(targetTemp - temperature));

    // Temperature health effects
    if (newTemp < 15)      healthDrain += 0.012;
    else if (newTemp < 30) healthDrain += 0.004;
    if (newTemp > 85)      healthDrain += 0.012;
    else if (newTemp > 70) healthDrain += 0.004;

    const newHealth = Math.max(0, health - healthDrain);
    const newThirstFinal = Math.min(100, newThirst + extraThirst);
    const newHungerFinal = Math.min(100, newHunger + extraHunger);

    updateStats({ health: newHealth, hunger: newHungerFinal, thirst: newThirstFinal, stamina: newStamina, fatigue: newFatigue, temperature: newTemp });

    // ── Kollaps: erzwingt Schlaf wenn Müdigkeit 95%+
    if (fStage >= 5 && !gameState.showSleepMenu) {
      useGameStore.getState().setShowSleepMenu(true, 'outdoor');
    }

    if (newHealth <= 0) {
      this.gameLoop.pause();
      gameState.setPhase('dead');
      return;
    }

    gameState.tickTime(100);
    gameState.addScore(0.1); // ~1 pt/sec survival

    // ── Food decay check (every 200 ticks = 20s real) ─────────────
    this.decayCheckTick++;
    if (this.decayCheckTick >= 200) {
      this.decayCheckTick = 0;
      this.checkFoodDecay(gameState.elapsedTime);
    }

    // ── Rain extinguishes campfires ────────────────────────────────
    if (this.isRaining) {
      const rainDamage: Record<string, number> = {
        drizzle: 0.08, shower: 0.25, rain: 0.50,
        downpour: 0.85, storm: 1.60, long_rain: 0.35,
      };
      const dmg = rainDamage[this.rainType] ?? 0.5;
      this.fireRainAccumulator += dmg;

      if (this.fireRainAccumulator >= 50) {
        this.fireRainAccumulator = 0;
        const worldState = useWorldStore.getState();
        const campfires = worldState.world?.structures.filter(
          s => s.type === 'campfire' && (s.fuel ?? 0) > 0
        ) ?? [];
        const extinguished = campfires.filter(cf => {
          const key = `${cf.x},${cf.y}`;
          // Campfires under jungle canopy are protected
          return !this.jungleCanopyCoveredTiles.has(key);
        });
        if (extinguished.length > 0) {
          for (const cf of extinguished) {
            worldState.updateStructure(cf.id, { fuel: 0 });
          }
          import('../../store/notificationStore').then(({ useNotificationStore }) => {
            useNotificationStore.getState().addNotification('Lagerfeuer erloschen! 💧🔥', 'levelup');
          });
        }
      }
    } else {
      this.fireRainAccumulator = 0;
    }

    // Drain campfire fuel once per game day + rain scheduling
    const currentDay = Math.floor(gameState.elapsedTime / DAY_DURATION_MS);
    if (currentDay !== this.lastGameDay && this.lastGameDay !== -1) {
      const worldState = useWorldStore.getState();
      const campfires = worldState.world?.structures.filter(s => s.type === 'campfire') ?? [];
      for (const cf of campfires) {
        const newFuel = Math.max(0, (cf.fuel ?? 0) - 1);
        worldState.updateStructure(cf.id, { fuel: newFuel });
      }
    }
    this.lastGameDay = currentDay;

    // Rain trigger — checked every tick so it fires as soon as daytime arrives
    const nextRainDay = useGameStore.getState().nextRainDay;
    if (!this.isRaining && currentDay >= nextRainDay) {
      const rainHour = (gameState.elapsedTime % DAY_DURATION_MS) / DAY_DURATION_MS * 24;
      if (rainHour >= 15 && rainHour < 22) {
        const worldState = useWorldStore.getState();
        this.pickRainType();
        this.isRaining = true;
        this.rainTimer = 0;
        const containers = worldState.world?.structures.filter(s => s.type === 'water_container') ?? [];
        for (const c of containers) worldState.updateStructure(c.id, { fuel: 2 });
        if (GameManager.FIRE_EXTINGUISHING_TYPES.has(this.rainType)) this.extinguishCampfires();
        useGameStore.getState().setNextRainDay(currentDay + 3 + Math.floor(Math.random() * 4));
        this.checkRainKnowledge();
      }
    }

    // Dev rain toggle
    const devRain = useGameStore.getState().devRain;
    if (devRain) {
      if (!this.isRaining) {
        this.pickRainType();
        this.isRaining = true;
        this.rainTimer = 0;
        const containers = useWorldStore.getState().world?.structures.filter(s => s.type === 'water_container') ?? [];
        for (const c of containers) useWorldStore.getState().updateStructure(c.id, { fuel: 2 });
        if (GameManager.FIRE_EXTINGUISHING_TYPES.has(this.rainType)) this.extinguishCampfires();
        this.checkRainKnowledge();
      } else {
        this.rainTimer = 500; // keep in full-rain zone
      }
    } else if (this.isRaining) {
      // devRain turned off → stop instantly
      this.isRaining = false;
      this.stopRain();
    }

    // Natural rain duration
    if (this.isRaining && !devRain) {
      this.rainTimer++;
      if (this.rainTimer > this.rainDuration) {
        this.isRaining = false;
        this.stopRain();
      }
    }

    const saveNow = Date.now();
    if (saveNow - this.lastSaveTime > this.autoSaveInterval) {
      this.lastSaveTime = saveNow;
    }
  }

  private gatherResource() {
    const gameState = useGameStore.getState();
    const { player, addToInventory } = usePlayerStore.getState();
    const worldState = useWorldStore.getState();
    if (!worldState.world) return;

    // Check if a gather was selected from the menu
    const pendingId     = gameState.pendingGatherId;
    const pendingAction = gameState.pendingGatherAction;
    if (pendingId) {
      gameState.setPendingGather(null);
      const resource = worldState.world.resources.find(r => r.id === pendingId && r.quantity > 0);
      if (resource) this.executeGather(resource, player, addToInventory, worldState, pendingAction);
      // Refresh menu with updated quantities (resource may be depleted)
      const { x, y } = usePlayerStore.getState().player;
      const _rHour = ((useGameStore.getState().elapsedTime % DAY_DURATION_MS) / DAY_DURATION_MS) * 24;
      const _rDewTime = _rHour >= 7 && _rHour < 9;
      const stillNearby = useWorldStore.getState().world?.resources.filter((r: any) => {
        if (r.quantity <= 0 || Math.abs(r.x - x) > 1 || Math.abs(r.y - y) > 1) return false;
        if (r.type === 'fern') return _rDewTime && !this.dewHarvestedFerns.has(`${r.x},${r.y}`);
        return true;
      }) ?? [];
      if (stillNearby.length > 0) gameState.openGatherMenu(stillNearby);
      else gameState.closeGatherMenu();
      return;
    }

    // Space pressed: scan nearby resources and open menu
    if (!this.keyPressed.space) return;
    this.keyPressed.space = false;

    const { x, y } = player;
    const _nowHour = ((useGameStore.getState().elapsedTime % DAY_DURATION_MS) / DAY_DURATION_MS) * 24;
    const _isDewTime = _nowHour >= 7 && _nowHour < 9;
    const nearby = worldState.world.resources.filter((r: any) => {
      if (Math.abs(r.x - x) > 1 || Math.abs(r.y - y) > 1) return false;
      if (r.quantity <= 0) return false;
      if (r.type === 'grass_tuft') return false; // decoration only
      // Fern only appears when dew is available
      if (r.type === 'fern') return _isDewTime && !this.dewHarvestedFerns.has(`${r.x},${r.y}`);
      return true;
    });
    if (nearby.length === 0) return;
    gameState.openGatherMenu(nearby);
  }

  private executeGather(resource: any, player: any, addToInventory: any, worldState: any, action: string | null = null) {

    // Always read fresh player state so equipment changes are reflected immediately
    const freshPlayer = usePlayerStore.getState().player;

    // Tool bonus: only equipped hand slots count (Option B)
    const eq = freshPlayer.equipment ?? { leftHand: null, rightHand: null };
    const handIds = [eq.leftHand?.resourceId, eq.rightHand?.resourceId].filter(Boolean) as string[];
    const hasFlintKnife  = handIds.includes('flint_knife');
    const hasAxe         = handIds.includes('stone_axe');
    const hasImpAxe     = handIds.includes('improved_axe');
    const hasIronAxe    = handIds.includes('iron_axe');
    const hasPickaxe    = handIds.includes('stone_pickaxe');
    const hasImpPick    = handIds.includes('improved_pickaxe');
    const hasIronPick   = handIds.includes('iron_pickaxe');
    const anyAxe        = hasIronAxe || hasImpAxe || hasAxe;
    const anyPick       = hasIronPick || hasImpPick || hasPickaxe;
    const anyKnife      = hasFlintKnife || anyAxe;

    // Per-resource stamina cost and time cost
    const T = DAY_DURATION_MS / 1440; // 1 game-minute in ms (~417ms)
    type GatherCost = { stamina: number; time: number };

    const cost: GatherCost = (() => {
      switch (resource.type) {
        // Light work — pick up
        case 'shells':       return { stamina: 2, time: T * 2 };
        case 'pebbles':      return { stamina: 2, time: T * 2 };
        case 'driftwood':    return { stamina: 2, time: T * 3 };
        case 'flint':        return { stamina: 2, time: T * 3 };
        case 'sticks':       return { stamina: 3, time: T * 3 };
        case 'palm_leaf':    return { stamina: 3, time: T * 3 };
        case 'herbs':        return { stamina: 3, time: T * 4 };
        case 'mushroom':     return { stamina: 3, time: T * 4 };
        case 'exotic_fruit': return { stamina: 3, time: T * 4 };
        case 'food':         return { stamina: 3, time: T * 4 };
        case 'spring':       return { stamina: 2, time: T * 2 };
        case 'puddle':       return { stamina: 2, time: T * 2 };
        case 'fern':         return { stamina: 1, time: T * 2 }; // handled separately — dew only
        case 'pandanus':     return { stamina: 3, time: T * 5 };
        case 'breadfruit_tree': return anyKnife ? { stamina: 4, time: T * 6 } : { stamina: 7, time: T * 12 };
        case 'bamboo':       return anyKnife ? { stamina: 4, time: T * 6 } : { stamina: 8, time: T * 15 };
        case 'cacao_tree':   return { stamina: 3, time: T * 5 };
        case 'palm_tree':    return anyKnife ? { stamina: 3, time: T * 5 } : { stamina: 5, time: T * 10 };
        // Medium — cutting (needs knife, costs more without)
        case 'fiber':        return anyKnife ? { stamina: 5, time: T * 8  } : { stamina: 10, time: T * 20 };
        case 'vine':         return anyKnife ? { stamina: 5, time: T * 8  } : { stamina: 10, time: T * 20 };
        case 'fish':         return { stamina: 5, time: T * 15 };
        // Heavy — chopping / mining
        case 'wood':         return anyAxe   ? { stamina: 5,  time: T * 15 } : { stamina: 10, time: T * 40 };
        case 'stone':        return anyPick  ? { stamina: 6,  time: T * 20 } : { stamina: 12, time: T * 50 };
        case 'iron_ore':     return anyPick  ? { stamina: 8,  time: T * 30 } : { stamina: 15, time: T * 80 };
        case 'granite':      return anyPick  ? { stamina: 7,  time: T * 25 } : { stamina: 14, time: T * 60 };
        case 'obsidian':     return anyPick  ? { stamina: 10, time: T * 35 } : { stamina: 20, time: T * 100 };
        case 'resin_tree':   return anyAxe   ? { stamina: 6,  time: T * 20 } : { stamina: 12, time: T * 50 };
        case 'large_tree':   return anyAxe   ? { stamina: 15, time: T * 60 } : null as any; // axe required
        case 'banyan_tree':  return anyAxe   ? { stamina: 18, time: T * 80 } : null as any; // axe required
        case 'coconut_shell': return { stamina: 2, time: T * 3 };
        default:             return { stamina: 3, time: T * 5 };
      }
    })();

    const currentStamina = usePlayerStore.getState().player.stats.stamina ?? 0;
    if (currentStamina < cost.stamina) return;

    // iron_ore still requires a pickaxe
    if (resource.type === 'iron_ore' && !anyPick) return;

    // fish: requires fishing_rod OR spear (spearfishing — 40% success chance)
    if (resource.type === 'fish') {
      const hasRod   = handIds.includes('fishing_rod');
      const hasSpear = handIds.includes('stone_spear');
      if (!hasRod && !hasSpear) {
        this.spawnFloatingText('Benötigt Angel oder Speer 🎣', player.x, player.y, '#f97316');
        return;
      }
      if (hasSpear && !hasRod && Math.random() > 0.40) {
        this.spawnFloatingText('Danebengworfen! 🐟', player.x, player.y, '#94a3b8');
        worldState.harvestResource(resource.id, 0);
        useGameStore.getState().tickTime(cost.time);
        usePlayerStore.getState().updateStats({ stamina: Math.max(0, currentStamina - cost.stamina) });
        usePlayerStore.getState().damageTool('stone_spear', 1);
        return;
      }
    }

    const timeCost    = cost.time;
    const staminaCost = cost.stamina;

    // Hard tool gates
    if ((resource.type === 'large_tree' || resource.type === 'banyan_tree') && !anyAxe) {
      this.spawnFloatingText('Benötigt Axt 🪓', player.x, player.y, '#f97316');
      return;
    }
    if (resource.type === 'wood' && !anyAxe) {
      this.spawnFloatingText('Benötigt Axt 🪓', player.x, player.y, '#f97316');
      return;
    }
    if (resource.type === 'stone' && !anyPick) {
      this.spawnFloatingText('Benötigt Spitzhacke ⛏️', player.x, player.y, '#f97316');
      return;
    }
    if (resource.type === 'resin_tree') {
      const inv = usePlayerStore.getState().player.inventory.items;
      const hasShell = inv.some(i => i.resourceId === 'coconut_shell' && i.quantity > 0);
      if (!anyAxe) {
        this.spawnFloatingText('Benötigt Axt 🪓', player.x, player.y, '#f97316');
        return;
      }
      if (!hasShell) {
        this.spawnFloatingText('Benötigt Kokosschale 🥥', player.x, player.y, '#f97316');
        return;
      }
    }

    // Puddle: drink directly — apply thirst reduction without adding to inventory
    if (resource.type === 'puddle') {
      if (resource.quantity < 1) return;
      worldState.harvestResource(resource.id, 1);
      const stats = usePlayerStore.getState().player.stats;
      usePlayerStore.getState().updateStats({
        thirst:  Math.max(0, (stats.thirst ?? 0) - 25),
        stamina: Math.min(100, (stats.stamina ?? 100) + 5),
      });
      useGameStore.getState().tickTime(timeCost);
      useGameStore.getState().addScore(10);
      usePlayerStore.getState().updateStats({
        stamina: Math.max(0, usePlayerStore.getState().player.stats.stamina - staminaCost),
      });
      this.spawnFloatingText('💧 Getrunken! Durst -25', player.x, player.y, '#38bdf8');
      // Tutorial step 1 — first water
      useTutorialStore.getState().completeStep(1);
      return;
    }

    // Fern: collect dew — plant stays, only dew-state tracked locally
    if (resource.type === 'fern') {
      const elapsedMs = useGameStore.getState().elapsedTime;
      const gameDay  = Math.floor(elapsedMs / DAY_DURATION_MS);
      const gameHour = ((elapsedMs % DAY_DURATION_MS) / DAY_DURATION_MS) * 24;
      // Reset dew at the start of each new day
      if (gameDay !== this.lastDewDay) {
        this.dewHarvestedFerns.clear();
        this.lastDewDay = gameDay;
      }
      const fernKey = `${resource.x},${resource.y}`;
      const alreadyHarvested = this.dewHarvestedFerns.has(fernKey);
      const isDewTime = gameHour >= 7 && gameHour < 9 && !alreadyHarvested;
      const hasShellInHand = handIds.includes('coconut_shell') || handIds.includes('shells');
      if (!hasShellInHand) {
        this.spawnFloatingText('Schale in die Hand nehmen 🐚 (Kokos- oder Muschel)', player.x, player.y, '#f97316');
        return;
      }
      if (!isDewTime) return;
      const dewInInventory = usePlayerStore.getState().player.inventory.items
        .find(i => i.resourceId === 'dew_water')?.quantity ?? 0;
      if (dewInInventory >= 3) {
        this.spawnFloatingText('Schale voll (3/3) — erst trinken 💧', player.x, player.y, '#94a3b8');
        return;
      }
      if (!this.dewTipShown) {
        this.dewTipShown = true;
        import('../../store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().addNotification(
            '💡 Tau verdampft nach ~2h — Schale nicht schließbar, bald trinken!',
            'levelup'
          );
        });
      }
      this.dewHarvestedFerns.add(fernKey);
      addToInventory('dew_water', 1);
      useGameStore.getState().tickTime(timeCost);
      usePlayerStore.getState().updateStats({ stamina: Math.max(0, currentStamina - staminaCost) });
      this.spawnFloatingText(`💧 Tau gesammelt! (${dewInInventory + 1}/3)`, player.x, player.y, '#38bdf8');
      return;
    }

    // Fell large trees — gives lots of wood + vines, removes tree
    if (resource.type === 'large_tree' || resource.type === 'banyan_tree') {
      const woodAmount = resource.type === 'banyan_tree'
        ? 7 + Math.floor(Math.random() * 4)  // 7–10 wood
        : 5 + Math.floor(Math.random() * 4); // 5–8 wood
      const vineAmount = resource.type === 'banyan_tree' ? 3 : 1;
      addToInventory('wood', woodAmount);
      if (vineAmount > 0) addToInventory('vine', vineAmount);
      worldState.harvestResource(resource.id, resource.quantity);
      useGameStore.getState().tickTime(timeCost);
      useGameStore.getState().addScore(resource.type === 'banyan_tree' ? 50 : 35);
      usePlayerStore.getState().updateStats({ stamina: Math.max(0, currentStamina - staminaCost) });
      usePlayerStore.getState().damageTool('stone_axe', 3);
      usePlayerStore.getState().damageTool('improved_axe', 2);
      usePlayerStore.getState().damageTool('iron_axe', 1);
      const label = resource.type === 'banyan_tree' ? 'Banyan gefällt' : 'Baum gefällt';
      this.spawnFloatingText(`🪓 ${label}! +${woodAmount} Holz`, player.x, player.y, '#a3e635');
      return;
    }

    // Chop palm tree — gives wood, removes tree entirely
    if (resource.type === 'palm_tree' && action === 'chop') {
      const woodAmount = 3 + Math.floor(Math.random() * 3); // 3-5 wood
      addToInventory('wood', woodAmount);
      worldState.harvestResource(resource.id, resource.quantity); // deplete all leaves
      useGameStore.getState().tickTime(timeCost * 3);
      useGameStore.getState().addScore(20);
      usePlayerStore.getState().updateStats({ stamina: Math.max(0, currentStamina - staminaCost * 2) });
      this.spawnFloatingText(`+${woodAmount} Holz 🪵`, player.x, player.y);
      return;
    }

    // Determine what item to give
    const giveType = action === 'sticks'                    ? 'sticks'
                   : action === 'coconut'                   ? 'coconut'
                   : resource.type === 'spring'             ? 'water'
                   : resource.type === 'palm_tree'          ? 'palm_leaf'
                   : resource.type === 'resin_tree'         ? 'tree_resin'
                   : resource.type === 'berry_bush'         ? 'food'
                   : resource.type === 'pandanus'           ? 'fiber'
                   : resource.type === 'breadfruit_tree'    ? 'exotic_fruit'
                   : resource.type === 'bamboo'             ? 'sticks'
                   : resource.type === 'cacao_tree'         ? 'food'
                   : resource.type;

    // Mining sound for hard materials
    const isMineType = ['stone', 'iron_ore', 'obsidian', 'granite'].includes(resource.type);
    if (isMineType) this.playMiningSound(resource.type === 'obsidian' || resource.type === 'iron_ore');

    // Always 1 per click
    const amount = Math.min(1, resource.quantity);
    if (addToInventory(giveType, amount)) {
      if (resource.type !== 'spring') worldState.harvestResource(resource.id, amount);

      // Bonus fiber from palm_tree with knife (axe chop only)
      if (resource.type === 'palm_tree' && anyKnife && action !== 'coconut') {
        addToInventory('fiber', 1);
      }
      if (resource.type === 'vine') {
        this.stripJungleVinesForResource(resource.id, player.x, player.y);
      }
      // Resin collection: consume one coconut shell
      if (resource.type === 'resin_tree') {
        usePlayerStore.getState().removeResource('coconut_shell', 1);
      }
      useGameStore.getState().tickTime(timeCost);
      useGameStore.getState().addScore(10);
      usePlayerStore.getState().updateStats({
        stamina: Math.max(0, currentStamina - staminaCost),
      });
      // Damage active tool based on resource type
      const toolDamageMap = TOOL_DAMAGE_ON_GATHER[resource.type];
      if (toolDamageMap) {
        const { damageTool } = usePlayerStore.getState();
        for (const [toolId, dmg] of Object.entries(toolDamageMap)) {
          if (handIds.includes(toolId)) { damageTool(toolId, dmg ?? 0); break; }
        }
      }

      // Award gather skill XP
      this.gatherPoseUntil = (this.scene?.time.now ?? 0) + 240;
      const gatherGrant = GATHER_SKILL_XP[giveType] ?? GATHER_SKILL_XP[resource.type];
      if (gatherGrant) {
        usePlayerStore.getState().gainSkillXp(gatherGrant.skill, gatherGrant.xp);
        import('../../store/notificationStore').then(({ useNotificationStore }) => {
          import('../../types/skills').then(({ SKILL_LABELS }) => {
            useNotificationStore.getState().addNotification(
              `+${gatherGrant.xp} ${SKILL_LABELS[gatherGrant.skill]}`,
              'xp'
            );
          });
        });
      }
      const label = action === 'coconut'
        ? `+${amount} Kokosnuss 🥥`
        : resource.type === 'palm_tree'
        ? `+${amount} Palmenblatt${anyKnife ? ' +1 Faser' : ''}`
        : resource.type === 'resin_tree'
          ? `+${amount} Baumharz 🫙`
          : action === 'sticks'
            ? `+${amount} Äste 🌿`
            : `+${amount} ${giveType}`;
      this.spawnFloatingText(label, player.x, player.y);
    }
  }

  // ── Interact with structure (E key) ──────────────────────────────

  private interactStructure() {
    const { player } = usePlayerStore.getState();
    const worldState = useWorldStore.getState();
    const structures = worldState.world?.structures ?? [];

    // F key: storage box + construction site + campfire refuel
    if (this.keyPressed.f) {
      this.keyPressed.f = false;

      // Palm shelter: open interior modal
      const palmShelter = structures.find(s => {
        if (s.type !== 'palm_shelter') return false;
        const w = s.width ?? 1;
        return s.y === player.y && player.x >= s.x - 1 && player.x < s.x + w + 1;
      });
      if (palmShelter) {
        useGameStore.getState().openPalmShelterModal(palmShelter.id);
        return;
      }

      // Campfire: open modal
      const campfire = structures.find(s => s.type === 'campfire' && Math.abs(s.x - player.x) <= 1 && Math.abs(s.y - player.y) <= 1);
      if (campfire) {
        useGameStore.getState().openCampfireModal(campfire.id);
        return;
      }

      // Arbeitsplatz: open crafting modal
      const arbeitsplatz = structures.find(s => s.type === 'arbeitsplatz' && Math.abs(s.x - player.x) <= 1 && Math.abs(s.y - player.y) <= 1);
      if (arbeitsplatz) {
        useGameStore.getState().setCraftingOpen(true);
        return;
      }

      // Water container (Regensammler): trinken wenn gefüllt
      const waterContainer = structures.find(s => s.type === 'water_container' && Math.abs(s.x - player.x) <= 1 && Math.abs(s.y - player.y) <= 1);
      if (waterContainer) {
        const water = waterContainer.fuel ?? 0;
        if (water <= 0) {
          this.spawnFloatingText('Leer – wartet auf Regen 🌧️', player.x, player.y, '#94a3b8');
        } else {
          worldState.updateStructure(waterContainer.id, { fuel: water - 1 });
          const { updateStats } = usePlayerStore.getState();
          const stats = usePlayerStore.getState().player.stats;
          updateStats({ thirst: Math.max(0, (stats.thirst ?? 0) - 25) });
          this.spawnFloatingText(`Durst -25 💧 (${water - 1} Schluck übrig)`, player.x, player.y, '#38bdf8');
        }
        return;
      }

      const storageBox = structures.find(s => s.type === 'storage_box' && Math.abs(s.x - player.x) <= 1 && Math.abs(s.y - player.y) <= 1);
      if (storageBox) {
        useGameStore.getState().openStorageBox(storageBox.id);
        return;
      }

      // Dropped items nearby → open pickup menu
      const drops = (worldState.world?.droppedItems ?? []).filter(
        d => Math.abs(d.x - player.x) <= 1 && Math.abs(d.y - player.y) <= 1
      );
      if (drops.length > 0) {
        useGameStore.getState().openPickupMenu(drops);
        return;
      }
    }

    // E key: sleep (always triggers regardless of other nearby structures)
    if (this.keyPressed.e) {
      this.keyPressed.e = false;

      const onCabin = structures.some(s =>
        ['wooden_shelter', 'log_cabin'].includes(s.type) &&
        s.x === player.x && s.y === player.y
      );
      const onShelter = structures.some(s => {
        if (s.type !== 'palm_shelter') return false;
        const w = s.width ?? 1;
        return s.y === player.y && player.x >= s.x && player.x < s.x + w;
      });
      const onSpot = structures.some(s =>
        s.type === 'sleeping_spot' && Math.abs(s.x - player.x) <= 1 && Math.abs(s.y - player.y) <= 1
      );

      const quality = onCabin ? 'cabin' : onShelter ? 'shelter' : onSpot ? 'spot' : 'outdoor';
      const campfireNear = structures.some(s =>
        s.type === 'campfire' && (s.fuel ?? 0) > 0 &&
        Math.abs(s.x - player.x) <= 4 && Math.abs(s.y - player.y) <= 4
      );
      useGameStore.getState().setCampfireNear(campfireNear);
      useGameStore.getState().setShowSleepMenu(true, quality);
    }
  }

  // ── Fishing (hold SPACE on water-adjacent tile with fishing_rod) ──

  private updateFishing(delta: number) {
    const { player, addToInventory } = usePlayerStore.getState();
    const worldState = useWorldStore.getState();
    if (!worldState.world) return;

    const inv = player.inventory;
    const hasRod = inv.items.some(i => i.resourceId === 'fishing_rod' && i.quantity > 0);
    if (!hasRod) { this.fishingStartTime = null; return; }

    // Check if on sand/grass next to water tile
    const tile = worldState.getTile(player.x, player.y);
    const isNearWater = tile?.type === 'sand' ||
      ['up','down','left','right'].some(dir => {
        const nx = player.x + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
        const ny = player.y + (dir === 'down'  ? 1 : dir === 'up'   ? -1 : 0);
        return worldState.getTile(nx, ny)?.type === 'water';
      });

    if (!isNearWater) { this.fishingStartTime = null; return; }

    // Space held down starts/continues fishing
    if (this.keyPressed.space) {
      // space is consumed by gatherResource first; fishing uses its own hold-detection
    }

    // Use scene input to detect held space
    const spaceDown = this.scene?.input?.keyboard?.checkDown(
      this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE), 0
    );

    if (spaceDown) {
      if (this.fishingStartTime === null) this.fishingStartTime = 0;
      this.fishingStartTime += delta;
      if (this.fishingStartTime >= this.FISHING_DURATION) {
        this.fishingStartTime = null;
        if (addToInventory('fish', 1)) {
          useGameStore.getState().addScore(15);
          this.spawnFloatingText('+1 Fisch 🐟', player.x, player.y, '#38bdf8');
        }
      }
    } else {
      this.fishingStartTime = null;
    }
  }

  // ── Farm plots: passive food production ──────────────────────────

  private updateFarmPlots(delta: number) {
    this.farmTick += delta;
    if (this.farmTick < this.FARM_INTERVAL) return;
    this.farmTick = 0;

    const worldState = useWorldStore.getState();
    const farms = worldState.world?.structures.filter(s => s.type === 'farm_plot') ?? [];
    if (farms.length === 0) return;

    const { addToInventory } = usePlayerStore.getState();
    const amount = farms.length;
    if (addToInventory('food', amount)) {
      const { x, y } = usePlayerStore.getState().player;
      this.spawnFloatingText(`+${amount} Nahrung 🌾`, x, y, '#86efac');
    }
  }

  // ── Mouse hover ───────────────────────────────────────────────────

  private updateHover() {
    if (!this.scene) return;
    const pointer = this.scene.input.activePointer;
    const world = useWorldStore.getState().world;
    if (!world) return;

    const wx = pointer.worldX;
    const wy = pointer.worldY;
    const tx = Math.floor(wx / TS);
    const ty = Math.floor(wy / TS);

    const res = world.resources.find(r => r.x === tx && r.y === ty && r.quantity > 0 && r.type !== 'grass_tuft') ?? null;
    useGameStore.getState().setHoveredResource(res);
  }

  // ── Mining sound (Web Audio API, no asset files needed) ──────────

  private playMiningSound(hard = false) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Impact thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hard ? 320 : 220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(hard ? 60 : 40, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.18);
      // Metallic noise burst
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * 0.06), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(hard ? 0.18 : 0.12, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      src.connect(g2); g2.connect(ctx.destination);
      src.start();
      setTimeout(() => ctx.close(), 400);
    } catch (_) {}
  }

  // ── Floating text popup ───────────────────────────────────────────

  private spawnFloatingText(text: string, tx: number, ty: number, color = '#ffffff') {
    if (!this.scene) return;
    const wx = tx * TS + TS / 2;
    const wy = ty * TS;
    const t = this.scene.add.text(wx, wy, text, {
      fontSize: '12px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(700_000);
    this.scene.tweens.add({
      targets: t, y: wy - 32, alpha: 0, duration: 1200,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  destroy() {
    useCraftingStore.getState().cancel();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.worldUnsubscribe?.();
    this.gameUnsubscribe?.();
    this.gameLoop.reset();
    this.game?.destroy(true);
    this.resourceObjects.clear();
    this.resourceQuantities.clear();
    this.game = null;
    this.scene = null;
    this.playerGraphics = null;
    this.tileGraphics = null;
    this.fogGraphics = null;
    this.dayNightRect = null;
    this.lightGraphics = null;
    this.fireGraphics = null;
    this.constructionGraphics = null;
    this.constructionArtKey = "";
    this.warmthGraphics = null;
    this.jungleTreeObjects = [];
    this.lizards.forEach(a => a.g.destroy()); this.lizards = [];
    this.parrots.forEach(a => a.g.destroy()); this.parrots = [];
    this.seagulls.forEach(a => a.g.destroy()); this.seagulls = [];
    this.butterflies.forEach(a => a.g.destroy()); this.butterflies = [];
    this.rats.forEach(a => a.g.destroy()); this.rats = [];
    this.footstepAudio.destroy();
  }

  // ── Boars ─────────────────────────────────────────────────────────

  private spawnBoars(world: any) {
    const BOAR_COUNT = 1;
    const BOAR_MAX_HP = 60;
    const candidates: { x: number; y: number }[] = [];
    for (let y = 3; y < world.height - 3; y++) {
      for (let x = 3; x < world.width - 3; x++) {
        const t = world.tileMap[y]?.[x]?.type;
        if (t !== 'dense_jungle') continue;
        const dist = Math.hypot(x - world.spawnX, y - world.spawnY);
        if (dist < 20) continue;
        candidates.push({ x, y });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const chosen = candidates.slice(0, BOAR_COUNT);
    for (let i = 0; i < chosen.length; i++) {
      const { x, y } = chosen[i];
      const px = x * TS + TS / 2;
      const py = y * TS + TS / 2;
      const g = this.scene!.add.graphics().setDepth(y * 1000 + 2);
      this.boars.push({
        id: `boar-${i}`,
        px, py,
        targetPx: px, targetPy: py,
        health: BOAR_MAX_HP,
        state: 'patrol',
        stateTimer: 2000 + Math.random() * 3000,
        lastAttack: 0,
        hitFlash: 0,
        deadAt: 0,
        waryTimer: 0,
        facingLeft: Math.random() > 0.5,
        g,
      });
      this.drawBoar(this.boars[this.boars.length - 1]);
    }
  }

  private drawBoar(boar: typeof this.boars[0]) {
    const g = boar.g;
    g.clear();
    if (boar.state === 'dead') return;

    const x = 0, y = 0;
    const flip = boar.facingLeft ? -1 : 1;
    const isChasing = boar.state === 'chase' || boar.state === 'attack';
    const isWary    = boar.state === 'wary';
    const flash = boar.hitFlash > 0;

    // Shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(x, y + 14, 34, 8);

    // Legs
    g.fillStyle(flash ? 0xff6666 : 0x3d1a0a);
    g.fillRect(x - 10, y + 8,  5, 10);
    g.fillRect(x - 3,  y + 8,  5, 10);
    g.fillRect(x + 4,  y + 8,  5, 10);
    g.fillRect(x + 11, y + 8,  5, 10);

    // Body
    const bodyColor = flash ? 0xff4444 : (isChasing ? 0x6b2a0e : 0x7a3010);
    g.fillStyle(bodyColor);
    g.fillEllipse(x, y, 34, 22);

    // Head
    const headColor = flash ? 0xff5555 : (isChasing ? 0x5a2008 : 0x6a2808);
    g.fillStyle(headColor);
    g.fillEllipse(x + flip * 17, y - 2, 18, 14);

    // Snout
    g.fillStyle(flash ? 0xff8888 : 0x9a4a20);
    g.fillEllipse(x + flip * 25, y, 10, 8);
    // Nostrils
    g.fillStyle(0x2a0a00);
    g.fillCircle(x + flip * 23, y - 1, 1.5);
    g.fillCircle(x + flip * 27, y - 1, 1.5);

    // Tusk
    g.fillStyle(0xf0e8c0);
    g.fillEllipse(x + flip * 24, y + 5, 8, 4);

    // Ear
    g.fillStyle(headColor);
    g.fillEllipse(x + flip * 13, y - 9, 7, 9);

    // Eye — red when chasing/attacking, orange when wary of fire, dark otherwise
    const eyeColor = isChasing ? 0xff2200 : isWary ? 0xff8800 : 0x111111;
    g.fillStyle(eyeColor);
    g.fillCircle(x + flip * 19, y - 4, 2);

    // Fire-fear indicator: small flame above head when wary
    if (isWary) {
      g.fillStyle(0xff6600, 0.8);
      g.fillTriangle(x + flip * 17, y - 16, x + flip * 14, y - 10, x + flip * 20, y - 10);
      g.fillStyle(0xffcc00, 0.9);
      g.fillTriangle(x + flip * 17, y - 14, x + flip * 15, y - 10, x + flip * 19, y - 10);
    }

    // Tail (small curl on opposite side)
    g.fillStyle(bodyColor);
    g.fillCircle(x - flip * 17, y - 4, 3);

    // HP bar (above boar)
    const BOAR_MAX_HP = 60;
    const hpPct = boar.health / BOAR_MAX_HP;
    const barW = 30;
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x - barW / 2 - 1, y - 22, barW + 2, 5);
    g.fillStyle(hpPct > 0.5 ? 0x44cc44 : hpPct > 0.25 ? 0xeeaa00 : 0xee2222);
    g.fillRect(x - barW / 2, y - 21, Math.round(barW * hpPct), 3);

    g.setPosition(boar.px, boar.py);
  }

  private updateBoars(delta: number) {
    if (!this.scene || this.boars.length === 0) return;
    if (useGameStore.getState().isPaused) return;
    const world = useWorldStore.getState().world;
    if (!world) return;

    const AGGRO_RANGE    = 5 * TS;
    const LOSE_RANGE     = 12 * TS;
    const ATTACK_RANGE   = 1.8 * TS;
    const FIRE_FEAR_DIST = 12 * TS;   // boar stays this far from fire sources
    const PATROL_SPEED   = 48;
    const CHASE_SPEED    = 80;
    const FLEE_SPEED     = 70;
    const ATTACK_DMG     = 10;
    const ATTACK_CD      = 1500;
    const DEAD_LINGER    = 1200;
    const WARY_CALM_MS   = 5000;      // time until boar calms after fire gone

    const gameState = useGameStore.getState();
    const ppx = this.playerPx + TS / 2;
    const ppy = this.playerPy + TS / 2;
    const now = Date.now();

    // Detect fire sources this frame
    const freshEq = usePlayerStore.getState().player.equipment;
    const handIds = [freshEq?.leftHand?.resourceId, freshEq?.rightHand?.resourceId].filter(Boolean) as string[];
    const playerHasTorch = handIds.includes('torch');

    const litCampfires = world.structures.filter(
      (s: any) => s.type === 'campfire' && (s.fuel ?? 0) > 0
    );

    // Returns the closest fire-source pixel position within FIRE_FEAR_DIST of (bx,by), or null
    const nearestFireSource = (bx: number, by: number): { fx: number; fy: number } | null => {
      let best: { fx: number; fy: number } | null = null;
      let bestDist2 = FIRE_FEAR_DIST * FIRE_FEAR_DIST;

      if (playerHasTorch) {
        const d2 = (bx - ppx) ** 2 + (by - ppy) ** 2;
        if (d2 < bestDist2) { bestDist2 = d2; best = { fx: ppx, fy: ppy }; }
      }
      for (const cf of litCampfires) {
        const cfpx = cf.x * TS + TS / 2;
        const cfpy = cf.y * TS + TS / 2;
        const d2 = (bx - cfpx) ** 2 + (by - cfpy) ** 2;
        if (d2 < bestDist2) { bestDist2 = d2; best = { fx: cfpx, fy: cfpy }; }
      }
      return best;
    };

    for (const boar of [...this.boars]) {
      // ── Dead state ────────────────────────────────────
      if (boar.state === 'dead') {
        if (now - boar.deadAt > DEAD_LINGER) {
          boar.g.destroy();
          this.boars = this.boars.filter(b => b.id !== boar.id);
        }
        continue;
      }

      const dx = ppx - boar.px;
      const dy = ppy - boar.py;
      const distToPlayer = Math.sqrt(dx * dx + dy * dy);

      // ── Hit flash decay ───────────────────────────────
      if (boar.hitFlash > 0) boar.hitFlash = Math.max(0, boar.hitFlash - delta);

      // ── Space key: player attacks boar ───────────────
      if (this.keyPressed.space && distToPlayer < ATTACK_RANGE && !gameState.gatherMenuOpen && !gameState.placementMode) {
        const atkEq = usePlayerStore.getState().player.equipment;
        const atkHands = [atkEq?.leftHand?.resourceId, atkEq?.rightHand?.resourceId].filter(Boolean) as string[];
        const hasWeapon = atkHands.some(id => ['stone_spear','flint_knife','stone_axe','improved_axe','iron_axe'].includes(id));
        const dmg = hasWeapon ? (25 + Math.random() * 10) : (5 + Math.random() * 3);
        boar.health = Math.max(0, boar.health - dmg);
        boar.hitFlash = 250;
        this.spawnFloatingText(`-${Math.round(dmg)}`, Math.floor(boar.px / TS), Math.floor(boar.py / TS), '#ff4444');
        // Damage weapon on hit
        if (hasWeapon) {
          const weaponId = atkHands.find(id => ['stone_spear','flint_knife','stone_axe','improved_axe','iron_axe'].includes(id));
          if (weaponId) usePlayerStore.getState().damageTool(weaponId, SPEAR_DAMAGE_PER_HIT);
        }
        this.keyPressed.space = false;

        if (boar.health <= 0) {
          const drops = 2 + (Math.random() > 0.4 ? 1 : 0);
          const tx2 = Math.floor(boar.px / TS), ty2 = Math.floor(boar.py / TS);
          useWorldStore.getState().dropItem('boar_meat', drops, tx2, ty2);
          useWorldStore.getState().dropItem('bone', 1 + (Math.random() > 0.5 ? 1 : 0), tx2, ty2);
          if (hasWeapon) {
            useWorldStore.getState().dropItem('hide', 1, tx2, ty2);
            if (Math.random() > 0.4) useWorldStore.getState().dropItem('fat', 1, tx2, ty2);
          }
          this.spawnFloatingText('🐗 Erlegt! Fleisch + Knochen', tx2, ty2 - 1, '#f97316');
          useJournalStore.getState().triggerJournalEvent('first_hunt_kill');
          boar.state = 'dead';
          boar.deadAt = now;
          boar.g.clear();
          const g = boar.g;
          g.fillStyle(0x000000, 0.25);
          g.fillEllipse(boar.px, boar.py + 10, 36, 8);
          g.fillStyle(0x5a2008);
          g.fillEllipse(boar.px, boar.py + 4, 34, 14);
          g.fillStyle(0x9a4a20);
          g.fillEllipse(boar.px + (boar.facingLeft ? -16 : 16), boar.py + 4, 12, 8);
          continue;
        }
      }

      // ── Fire-fear check ───────────────────────────────
      const fireSource = nearestFireSource(boar.px, boar.py);
      if (fireSource) {
        // Fire nearby — become/stay wary, flee from fire source
        boar.waryTimer = WARY_CALM_MS;
        if (boar.state !== 'wary') boar.state = 'wary';
        // Flee target: directly away from fire source
        const fdx = boar.px - fireSource.fx;
        const fdy = boar.py - fireSource.fy;
        const fdist = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
        boar.targetPx = boar.px + (fdx / fdist) * FIRE_FEAR_DIST;
        boar.targetPy = boar.py + (fdy / fdist) * FIRE_FEAR_DIST;
        boar.facingLeft = fdx < 0;
      } else if (boar.state === 'wary') {
        // Fire gone — count down wary timer
        boar.waryTimer -= delta;
        if (boar.waryTimer <= 0) {
          boar.state = 'patrol';
          boar.stateTimer = 0;
        }
      }

      if (boar.state !== 'wary') {
        // ── Normal state transitions ─────────────────────
        if (boar.state !== 'attack') {
          if (distToPlayer < AGGRO_RANGE) {
            boar.state = distToPlayer < ATTACK_RANGE ? 'attack' : 'chase';
          } else if (boar.state === 'chase' && distToPlayer > LOSE_RANGE) {
            boar.state = 'patrol';
            boar.stateTimer = 2000 + Math.random() * 3000;
          }
        } else {
          if (distToPlayer > ATTACK_RANGE) {
            boar.state = distToPlayer < LOSE_RANGE ? 'chase' : 'patrol';
          }
        }

        boar.stateTimer -= delta;

        // ── Patrol: pick new non-beach target ────────────
        if (boar.state === 'patrol' && boar.stateTimer <= 0) {
          const tx = Math.floor(boar.px / TS);
          const ty = Math.floor(boar.py / TS);
          const candidates: { x: number; y: number }[] = [];
          for (let dy2 = -5; dy2 <= 5; dy2++) {
            for (let dx2 = -5; dx2 <= 5; dx2++) {
              const nx = tx + dx2, ny = ty + dy2;
              const t = world.tileMap[ny]?.[nx];
              // Never go to beach or water
              if (t?.walkable && t.type !== 'beach' && t.type !== 'sand' && t.type !== 'water') {
                candidates.push({ x: nx, y: ny });
              }
            }
          }
          if (candidates.length > 0) {
            const t = candidates[Math.floor(Math.random() * candidates.length)];
            boar.targetPx = t.x * TS + TS / 2;
            boar.targetPy = t.y * TS + TS / 2;
            boar.facingLeft = boar.targetPx < boar.px;
            boar.stateTimer = 4000 + Math.random() * 4000;
          } else {
            boar.stateTimer = 1000;
          }
        }

        // ── Attack: deal damage on cooldown ──────────────
        if (boar.state === 'attack' && now - boar.lastAttack > ATTACK_CD) {
          boar.lastAttack = now;
          const { updateStats, player } = usePlayerStore.getState();
          updateStats({ health: Math.max(0, player.stats.health - ATTACK_DMG) });
          this.spawnFloatingText(`-${ATTACK_DMG} HP`, Math.floor(ppx / TS), Math.floor(ppy / TS), '#ff2222');
          // Chance to cause bleeding
          if (Math.random() < BLEED_ON_BOAR_ATTACK) {
            const bleedEnd = Date.now() + BLEED_DURATION;
            usePlayerStore.getState().updateStats({ bleedingUntil: bleedEnd });
            this.spawnFloatingText('🩸 Blutung!', Math.floor(ppx / TS), Math.floor(ppy / TS) - 1, '#dc2626');
            import('../../store/notificationStore').then(({ useNotificationStore }) => {
              useNotificationStore.getState().addNotification('Du blutest! Verband anlegen! 🩸', 'levelup');
            });
          }
        }
      }

      // ── Movement ──────────────────────────────────────
      let speed = 0;
      let targetX = boar.targetPx;
      let targetY = boar.targetPy;

      if (boar.state === 'wary') {
        speed = FLEE_SPEED;
      } else if (boar.state === 'chase' || boar.state === 'attack') {
        speed = CHASE_SPEED;
        targetX = ppx;
        targetY = ppy;
        boar.facingLeft = ppx < boar.px;
      } else if (boar.state === 'patrol') {
        speed = PATROL_SPEED;
      }

      if (speed > 0) {
        const tdx = targetX - boar.px;
        const tdy = targetY - boar.py;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tdist > 4) {
          const step = speed * delta / 1000;
          boar.px += (tdx / tdist) * step;
          boar.py += (tdy / tdist) * step;
          if (boar.state === 'patrol') boar.facingLeft = tdx < 0;
        } else if (boar.state === 'patrol') {
          boar.stateTimer = 0;
        }
      }

      boar.g.setDepth(Math.floor(boar.py / TS) * 1000 + 2);
      if (this.isInViewport(boar.px, boar.py)) this.drawBoar(boar);
    }
  }

  // ── Lizards ────────────────────────────────────────────────────────
  private spawnLizards(world: any) {
    const COUNT = 18;
    const candidates: { x: number; y: number }[] = [];
    for (let y = 3; y < world.height - 3; y++) {
      for (let x = 3; x < world.width - 3; x++) {
        const t = world.tileMap[y]?.[x]?.type;
        if (t !== 'grass' && t !== 'sparse_forest') continue;
        if (Math.hypot(x - world.spawnX, y - world.spawnY) < 8) continue;
        candidates.push({ x, y });
      }
    }
    for (let i = 0; i < Math.min(COUNT, candidates.length); i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const [c] = candidates.splice(idx, 1);
      const g = this.scene!.add.graphics().setDepth(c.y * 1000 + 2);
      this.lizards.push({
        id: `lizard-${i}`, px: c.x * TS + TS / 2, py: c.y * TS + TS / 2,
        targetPx: 0, targetPy: 0, state: 'idle',
        stateTimer: 1000 + Math.random() * 3000, facingLeft: Math.random() < 0.5, g,
      });
      this.drawLizard(this.lizards[this.lizards.length - 1]);
    }
  }

  private drawLizard(lz: typeof this.lizards[0]) {
    const g = lz.g; g.clear();
    const f = lz.facingLeft ? -1 : 1;
    // shadow
    g.fillStyle(0x000000, 0.18); g.fillEllipse(0, 6, 18, 5);
    // body
    g.fillStyle(0x4a8c3a); g.fillEllipse(0, 0, 14, 7);
    // head
    g.fillStyle(0x3d7830); g.fillEllipse(f * 9, -1, 8, 5);
    // eye
    g.fillStyle(0xffd700); g.fillCircle(f * 11, -2, 1.5);
    g.fillStyle(0x000000); g.fillCircle(f * 11, -2, 0.8);
    // tail
    g.lineStyle(2, 0x4a8c3a, 1);
    g.beginPath(); g.moveTo(-f * 6, 1); g.lineTo(-f * 14, 4); g.strokePath();
    // legs
    g.lineStyle(1.5, 0x3d7830, 1);
    g.beginPath(); g.moveTo(f * 3, 2); g.lineTo(f * 6, 7); g.strokePath();
    g.beginPath(); g.moveTo(-f * 2, 2); g.lineTo(-f * 5, 7); g.strokePath();
    g.setPosition(lz.px, lz.py);
  }

  private updateLizards(delta: number) {
    if (!this.scene || this.lizards.length === 0) return;
    const player = usePlayerStore.getState().player;
    const ppx = player.x * TS + TS / 2, ppy = player.y * TS + TS / 2;
    const FLEE_R = 3.5 * TS, FLEE_SPEED = 140, WANDER_SPEED = 28;
    const tileMap = useWorldStore.getState().world?.tileMap;

    for (const lz of this.lizards) {
      const dist = Math.hypot(ppx - lz.px, ppy - lz.py);
      if (dist < FLEE_R && lz.state !== 'flee') {
        lz.state = 'flee';
        const angle = Math.atan2(lz.py - ppy, lz.px - ppx);
        lz.targetPx = lz.px + Math.cos(angle) * 4 * TS;
        lz.targetPy = lz.py + Math.sin(angle) * 4 * TS;
        lz.facingLeft = Math.cos(angle) < 0;
        lz.stateTimer = 1800;
      }
      lz.stateTimer -= delta;
      if (lz.state === 'flee' && lz.stateTimer <= 0) { lz.state = 'idle'; lz.stateTimer = 2000 + Math.random() * 3000; }
      if (lz.state === 'idle' && lz.stateTimer <= 0) {
        const tx = Math.floor(lz.px / TS), ty = Math.floor(lz.py / TS);
        const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
        const valid = dirs.filter(([dx,dy]) => {
          const t = tileMap?.[ty+dy]?.[tx+dx]?.type;
          return t === 'grass' || t === 'sparse_forest';
        });
        if (valid.length) {
          const [dx, dy] = valid[Math.floor(Math.random() * valid.length)];
          lz.targetPx = (tx + dx) * TS + TS / 2;
          lz.targetPy = (ty + dy) * TS + TS / 2;
          lz.facingLeft = dx < 0;
          lz.state = 'wander'; lz.stateTimer = 4000 + Math.random() * 3000;
        } else { lz.stateTimer = 1500; }
      }
      const speed = lz.state === 'flee' ? FLEE_SPEED : lz.state === 'wander' ? WANDER_SPEED : 0;
      if (speed > 0) {
        const tdx = lz.targetPx - lz.px, tdy = lz.targetPy - lz.py;
        const td = Math.sqrt(tdx*tdx + tdy*tdy);
        if (td > 2) { lz.px += (tdx/td)*(speed*delta/1000); lz.py += (tdy/td)*(speed*delta/1000); }
        else if (lz.state === 'wander') { lz.state = 'idle'; lz.stateTimer = 1500 + Math.random() * 2500; }
      }
      const inView = this.isInViewport(lz.px, lz.py);
      lz.g.setVisible(inView);
      if (inView) {
        lz.g.setDepth(Math.floor(lz.py / TS) * 1000 + 2);
        this.drawLizard(lz);
      }
    }
  }

  // ── Parrots ────────────────────────────────────────────────────────
  private spawnParrots(_world: any) {
    const COUNT = 12;
    // Find large tree resource positions
    const resources = useWorldStore.getState().world?.resources ?? [];
    const treeTiles = resources.filter((r: any) => r.type === 'large_tree' || r.type === 'banyan_tree');
    const candidates = treeTiles.length > 0 ? treeTiles : [];
    for (let i = 0; i < Math.min(COUNT, candidates.length); i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const c = candidates[idx];
      const g = this.scene!.add.graphics().setDepth(c.y * 1000 + 500);
      this.parrots.push({
        id: `parrot-${i}`,
        px: c.x * TS + TS / 2 + (Math.random() - 0.5) * TS,
        py: c.y * TS - TS * 1.5,
        state: 'perch', stateTimer: 3000 + Math.random() * 6000,
        arcT: 0, arcStartX: 0, arcStartY: 0, arcEndX: 0, arcEndY: 0,
        facingLeft: Math.random() < 0.5, g,
      });
      this.drawParrot(this.parrots[this.parrots.length - 1]);
    }
  }

  private drawParrot(p: typeof this.parrots[0]) {
    const g = p.g; g.clear();
    const f = p.facingLeft ? -1 : 1;
    const flying = p.state === 'fly';
    const wingY = flying ? Math.sin(Date.now() / 80) * 6 : 0;
    // shadow (only when flying low)
    // body
    g.fillStyle(0x1a8a1a); g.fillEllipse(0, 0, 12, 8);
    // wing
    g.fillStyle(flying ? 0x22bb22 : 0x157815);
    g.fillEllipse(-f * 4, wingY - 2, 14, 5);
    // tail
    g.fillStyle(0xff4400); g.fillEllipse(-f * 8, 3, 8, 4);
    // head
    g.fillStyle(0xff2200); g.fillCircle(f * 6, -3, 5);
    // beak
    g.fillStyle(0xffcc00); g.fillTriangle(f*10, -3, f*13, -1, f*10, -1);
    // eye
    g.fillStyle(0xffffff); g.fillCircle(f * 7, -4, 1.5);
    g.fillStyle(0x000000); g.fillCircle(f * 7, -4, 0.8);
    g.setPosition(p.px, p.py);
  }

  private updateParrots(delta: number) {
    if (!this.scene) return;
    const player = usePlayerStore.getState().player;
    const ppx = player.x * TS + TS / 2, ppy = player.y * TS + TS / 2;
    const FLEE_R = 4 * TS;
    const resources = useWorldStore.getState().world?.resources ?? [];
    const treeTiles = resources.filter((r: any) => r.type === 'large_tree' || r.type === 'banyan_tree');

    for (const p of this.parrots) {
      const dist = Math.hypot(ppx - p.px, ppy - p.py);
      if (dist < FLEE_R && p.state === 'perch') {
        p.state = 'fly'; p.arcT = 0;
        p.arcStartX = p.px; p.arcStartY = p.py;
        // Pick a distant tree to land on
        const far = treeTiles.filter((t: any) => Math.hypot(t.x * TS - ppx, t.y * TS - ppy) > 8 * TS);
        const dest = far.length ? far[Math.floor(Math.random() * far.length)] : { x: p.px / TS + 15, y: p.py / TS + 5 };
        p.arcEndX = (dest as any).x * TS + TS / 2 + (Math.random() - 0.5) * TS;
        p.arcEndY = (dest as any).y * TS - TS * 1.5;
        p.facingLeft = p.arcEndX < p.px;
        p.stateTimer = 2500;
      }
      if (p.state === 'fly') {
        p.arcT += delta / p.stateTimer;
        if (p.arcT >= 1) {
          p.arcT = 1; p.state = 'perch';
          p.stateTimer = 4000 + Math.random() * 8000;
        }
        const t = p.arcT;
        p.px = p.arcStartX + (p.arcEndX - p.arcStartX) * t;
        const arcHeight = -Math.sin(t * Math.PI) * 5 * TS;
        p.py = p.arcStartY + (p.arcEndY - p.arcStartY) * t + arcHeight;
      } else {
        p.stateTimer -= delta;
        // occasional fidget
        if (p.stateTimer <= 0 && p.state === 'perch') {
          p.facingLeft = !p.facingLeft;
          p.stateTimer = 2000 + Math.random() * 5000;
        }
      }
      const inView = this.isInViewport(p.px, p.py, 5 * TS);
      p.g.setVisible(inView);
      if (inView) {
        p.g.setDepth(Math.floor(p.py / TS) * 1000 + 500);
        this.drawParrot(p);
      }
    }
  }

  // ── Seagulls ───────────────────────────────────────────────────────
  private spawnSeagulls(world: any) {
    const COUNT = 8;
    const beachTiles: { x: number; y: number }[] = [];
    for (let y = 2; y < world.height - 2; y++) {
      for (let x = 2; x < world.width - 2; x++) {
        if (world.tileMap[y]?.[x]?.type === 'beach') beachTiles.push({ x, y });
      }
    }
    for (let i = 0; i < COUNT; i++) {
      if (beachTiles.length === 0) break;
      const c = beachTiles[Math.floor(Math.random() * beachTiles.length)];
      const g = this.scene!.add.graphics().setDepth(9999);
      this.seagulls.push({
        id: `seagull-${i}`,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: (3 + Math.random() * 3) * TS,
        orbitCx: c.x * TS + TS / 2,
        orbitCy: c.y * TS + TS / 2,
        orbitSpeed: (0.4 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1),
        g,
      });
      this.drawSeagull(this.seagulls[this.seagulls.length - 1]);
    }
  }

  private drawSeagull(sg: typeof this.seagulls[0]) {
    const g = sg.g; g.clear();
    const wingFlap = Math.sin(Date.now() / 200 + sg.orbitAngle) * 5;
    // body
    g.fillStyle(0xffffff, 0.95); g.fillEllipse(0, 0, 14, 6);
    // wings
    g.fillStyle(0xe8e8e8);
    g.fillEllipse(-11, wingFlap, 12, 4);
    g.fillEllipse(11, wingFlap, 12, 4);
    // head
    g.fillStyle(0xffffff); g.fillCircle(8, -2, 4);
    g.fillStyle(0xffcc00); g.fillTriangle(11, -2, 14, -1, 11, 0);
    // wing tips dark
    g.fillStyle(0x222222);
    g.fillEllipse(-16, wingFlap, 4, 3);
    g.fillEllipse(16, wingFlap, 4, 3);
    const px = sg.orbitCx + Math.cos(sg.orbitAngle) * sg.orbitRadius;
    const py = sg.orbitCy + Math.sin(sg.orbitAngle) * sg.orbitRadius * 0.4 - 3 * TS;
    g.setPosition(px, py);
  }

  private updateSeagulls(delta: number) {
    if (!this.scene) return;
    const player = usePlayerStore.getState().player;
    const ppx = player.x * TS + TS / 2, ppy = player.y * TS + TS / 2;
    const SOUND_R = 10 * TS;
    this.seagullSoundCooldown -= delta;

    let nearestDist = Infinity;
    for (const sg of this.seagulls) {
      sg.orbitAngle += sg.orbitSpeed * delta / 1000;
      const sx = sg.orbitCx + Math.cos(sg.orbitAngle) * sg.orbitRadius;
      const sy = sg.orbitCy + Math.sin(sg.orbitAngle) * sg.orbitRadius * 0.4 - 3 * TS;
      const d = Math.hypot(ppx - sx, ppy - sy);
      if (d < nearestDist) nearestDist = d;
      const inView = this.isInViewport(sx, sy, 8 * TS);
      sg.g.setVisible(inView);
      if (inView) this.drawSeagull(sg);
    }

    if (nearestDist < SOUND_R && this.seagullSoundCooldown <= 0) {
      this.playSeagullCry(1 - nearestDist / SOUND_R);
      // Random interval so cries feel natural, not robotic
      this.seagullSoundCooldown = 4000 + Math.random() * 6000;
    }
  }

  private playSeagullCry(volume: number) {
    try {
      const file = Math.random() < 0.5 ? 'Möwe 1.mp3' : 'Möwe 2.mp3';
      const audio = new Audio(`/music/${encodeURIComponent(file)}`);
      audio.volume = Math.min(1, volume * 0.9);
      audio.play().catch(() => {});
    } catch {}
  }

  // ── Butterflies ────────────────────────────────────────────────────
  private spawnButterflies(world: any) {
    const COUNT = 20;
    const candidates: { x: number; y: number }[] = [];
    for (let y = 3; y < world.height - 3; y++) {
      for (let x = 3; x < world.width - 3; x++) {
        const t = world.tileMap[y]?.[x]?.type;
        if (t !== 'grass' && t !== 'tall_grass') continue;
        candidates.push({ x, y });
      }
    }
    for (let i = 0; i < Math.min(COUNT, candidates.length); i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const [c] = candidates.splice(idx, 1);
      const g = this.scene!.add.graphics().setDepth(c.y * 1000 + 10);
      this.butterflies.push({
        id: `butterfly-${i}`,
        px: c.x * TS + TS / 2, py: c.y * TS + TS / 2,
        targetPx: 0, targetPy: 0,
        state: 'rest', stateTimer: 2000 + Math.random() * 4000,
        phase: Math.random() * Math.PI * 2, g,
      });
      this.drawButterfly(this.butterflies[this.butterflies.length - 1]);
    }
  }

  private drawButterfly(bf: typeof this.butterflies[0]) {
    const g = bf.g; g.clear();
    const flutter = bf.state === 'flutter';
    const wingOpen = flutter ? Math.abs(Math.sin(Date.now() / 120 + bf.phase)) : 1;
    const colors = [0xff6699, 0xffaa00, 0x44aaff, 0xff4444, 0xaa44ff];
    const col = colors[parseInt(bf.id.split('-')[1]) % colors.length];
    // upper wings
    g.fillStyle(col, 0.85);
    g.fillEllipse(-wingOpen * 7, -4, wingOpen * 8, 7);
    g.fillEllipse(wingOpen * 7, -4, wingOpen * 8, 7);
    // lower wings
    g.fillStyle(col, 0.65);
    g.fillEllipse(-wingOpen * 5, 3, wingOpen * 6, 5);
    g.fillEllipse(wingOpen * 5, 3, wingOpen * 6, 5);
    // body
    g.fillStyle(0x222222); g.fillEllipse(0, 0, 2.5, 9);
    g.setPosition(bf.px, bf.py);
  }

  private updateButterflies(delta: number) {
    if (!this.scene) return;
    const tileMap = useWorldStore.getState().world?.tileMap;
    const SPEED = 22;

    for (const bf of this.butterflies) {
      bf.stateTimer -= delta;
      if (bf.state === 'rest' && bf.stateTimer <= 0) {
        const tx = Math.floor(bf.px / TS), ty = Math.floor(bf.py / TS);
        const angle = Math.random() * Math.PI * 2;
        const dist = (2 + Math.random() * 3) * TS;
        const nx = tx + Math.round(Math.cos(angle) * 3);
        const ny = ty + Math.round(Math.sin(angle) * 3);
        const nt = tileMap?.[ny]?.[nx]?.type;
        if (nt === 'grass' || nt === 'tall_grass') {
          bf.targetPx = nx * TS + TS / 2; bf.targetPy = ny * TS + TS / 2;
          bf.state = 'flutter'; bf.stateTimer = (dist / SPEED) * 1000 + 500;
        } else { bf.stateTimer = 1000 + Math.random() * 2000; }
      }
      if (bf.state === 'flutter' && bf.stateTimer <= 0) {
        bf.state = 'rest'; bf.stateTimer = 1500 + Math.random() * 3000;
      }
      if (bf.state === 'flutter') {
        const tdx = bf.targetPx - bf.px, tdy = bf.targetPy - bf.py;
        const td = Math.sqrt(tdx*tdx + tdy*tdy);
        bf.phase += delta / 60;
        // sine wave perpendicular drift for natural feel
        const perp = Math.sin(bf.phase * 3) * 0.4;
        if (td > 3) {
          bf.px += (tdx/td + perp) * SPEED * delta / 1000;
          bf.py += (tdy/td) * SPEED * delta / 1000;
        }
      }
      const inView = this.isInViewport(bf.px, bf.py);
      bf.g.setVisible(inView);
      if (inView) {
        bf.g.setDepth(Math.floor(bf.py / TS) * 1000 + 10);
        this.drawButterfly(bf);
      }
    }
  }

  // ── Rats ───────────────────────────────────────────────────────────
  private spawnRats(world: any) {
    const COUNT = 14;
    const candidates: { x: number; y: number }[] = [];
    for (let y = 3; y < world.height - 3; y++) {
      for (let x = 3; x < world.width - 3; x++) {
        const t = world.tileMap[y]?.[x]?.type;
        if (t !== 'grass' && t !== 'sparse_forest' && t !== 'forest') continue;
        if (Math.hypot(x - world.spawnX, y - world.spawnY) < 6) continue;
        candidates.push({ x, y });
      }
    }
    for (let i = 0; i < Math.min(COUNT, candidates.length); i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const [c] = candidates.splice(idx, 1);
      const g = this.scene!.add.graphics().setDepth(c.y * 1000 + 2);
      this.rats.push({
        id: `rat-${i}`, px: c.x * TS + TS / 2, py: c.y * TS + TS / 2,
        targetPx: 0, targetPy: 0, state: 'idle',
        stateTimer: 500 + Math.random() * 2000, facingLeft: Math.random() < 0.5, g,
      });
      this.drawRat(this.rats[this.rats.length - 1]);
    }
  }

  private drawRat(rat: typeof this.rats[0]) {
    const g = rat.g; g.clear();
    const f = rat.facingLeft ? -1 : 1;
    const isNight = (() => {
      const elapsed = useGameStore.getState().elapsedTime;
      const hour = (elapsed % (24 * 60 * 1000)) / (24 * 60 * 1000) * 24;
      return hour >= 20 || hour < 6;
    })();
    const alpha = isNight ? 1 : 0.55; // rats visible but dim in daylight
    // shadow
    g.fillStyle(0x000000, 0.15 * alpha); g.fillEllipse(0, 6, 16, 4);
    // body
    g.fillStyle(0x6e6050, alpha); g.fillEllipse(0, 0, 16, 8);
    // head
    g.fillStyle(0x5a4e40, alpha); g.fillEllipse(f * 9, -1, 9, 6);
    // nose
    g.fillStyle(0xff9999, alpha); g.fillCircle(f * 13, -1, 1.5);
    // ear
    g.fillStyle(0xd4a0a0, alpha); g.fillEllipse(f * 8, -5, 4, 5);
    // eye
    g.fillStyle(0xff2200, alpha); g.fillCircle(f * 11, -2, 1.2);
    // tail
    g.lineStyle(1.5, 0x8a7060, alpha);
    g.beginPath(); g.moveTo(-f * 7, 1); g.lineTo(-f * 15, 5); g.strokePath();
    g.setPosition(rat.px, rat.py);
  }

  private updateRats(delta: number) {
    if (!this.scene) return;
    const player = usePlayerStore.getState().player;
    const ppx = player.x * TS + TS / 2, ppy = player.y * TS + TS / 2;
    const elapsed = useGameStore.getState().elapsedTime;
    const hour = (elapsed % (24 * 60 * 1000)) / (24 * 60 * 1000) * 24;
    const isNight = hour >= 20 || hour < 6;
    const FLEE_R = 3 * TS;
    const FLEE_SPEED = 120, WANDER_SPEED = isNight ? 40 : 18;
    const tileMap = useWorldStore.getState().world?.tileMap;

    for (const rat of this.rats) {
      const dist = Math.hypot(ppx - rat.px, ppy - rat.py);
      if (dist < FLEE_R && rat.state !== 'flee') {
        rat.state = 'flee'; rat.stateTimer = 1500;
        const angle = Math.atan2(rat.py - ppy, rat.px - ppx);
        rat.targetPx = rat.px + Math.cos(angle) * 3.5 * TS;
        rat.targetPy = rat.py + Math.sin(angle) * 3.5 * TS;
        rat.facingLeft = Math.cos(angle) < 0;
      }
      rat.stateTimer -= delta;
      if (rat.state === 'flee' && rat.stateTimer <= 0) { rat.state = 'idle'; rat.stateTimer = 1000 + Math.random() * 2000; }
      if (rat.state === 'idle' && rat.stateTimer <= 0) {
        // Rats wander more at night
        if (isNight || Math.random() < 0.4) {
          const tx = Math.floor(rat.px / TS), ty = Math.floor(rat.py / TS);
          const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-2,0],[2,0],[0,-2],[0,2]];
          const valid = dirs.filter(([dx,dy]) => {
            const t = tileMap?.[ty+dy]?.[tx+dx]?.type;
            return t === 'grass' || t === 'sparse_forest' || t === 'forest';
          });
          if (valid.length) {
            const [dx, dy] = valid[Math.floor(Math.random() * valid.length)];
            rat.targetPx = (tx + dx) * TS + TS / 2;
            rat.targetPy = (ty + dy) * TS + TS / 2;
            rat.facingLeft = dx < 0;
            rat.state = 'wander'; rat.stateTimer = 3000 + Math.random() * 3000;
          } else { rat.stateTimer = 800; }
        } else { rat.stateTimer = 1500 + Math.random() * 2000; }
      }
      const speed = rat.state === 'flee' ? FLEE_SPEED : rat.state === 'wander' ? WANDER_SPEED : 0;
      if (speed > 0) {
        const tdx = rat.targetPx - rat.px, tdy = rat.targetPy - rat.py;
        const td = Math.sqrt(tdx*tdx + tdy*tdy);
        if (td > 2) { rat.px += (tdx/td)*(speed*delta/1000); rat.py += (tdy/td)*(speed*delta/1000); }
        else if (rat.state === 'wander') { rat.state = 'idle'; rat.stateTimer = 1000 + Math.random() * 2000; }
      }
      const inView = this.isInViewport(rat.px, rat.py);
      rat.g.setVisible(inView);
      if (inView) {
        rat.g.setDepth(Math.floor(rat.py / TS) * 1000 + 2);
        this.drawRat(rat);
      }
    }
  }
}
