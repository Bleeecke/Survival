import Phaser from 'phaser';
import { GameLoop } from '../game/GameLoop';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { WORLD_CONFIG, DAY_DURATION_MS } from '../../data/worldConfig';
import { WorldGenerator } from './WorldGenerator';
import { RECIPES } from '../../data/recipes';
import { BUILD_DEFINITIONS } from '../../data/buildDefinitions';
import type { KnowledgeFlag } from '../../data/knowledge';
import { RAIN_KNOWLEDGE_GRANTS } from '../../data/knowledge';
import { useTutorialStore } from '../../store/tutorialStore';
import { craftingSystem } from '../game/CraftingSystem';
import { FootstepAudio } from '../game/FootstepAudio';
import { GATHER_SKILL_XP } from '../../types/skills';
import { TOOL_DAMAGE_ON_GATHER, SPEAR_DAMAGE_PER_HIT } from '../../data/toolDurability';
import { calcWeight, MAX_CARRY_KG } from '../../data/weights';
import { FOOD_SPOIL_TIME, FOOD_ITEM_NAMES } from '../../data/foodDecay';
import { DISEASE_DRAIN, COLD_EXPOSURE_THRESHOLD, FEVER_FROM_COLD_CHANCE,
         INJURY_DRAIN, BLEED_ON_BOAR_ATTACK, BLEED_DURATION, WOUND_DURATION } from '../../data/diseases';

const TS = WORLD_CONFIG.tileSize; // 32px
const SIGHT_DAY = 12;
const SIGHT_NIGHT = 2;
const CAMPFIRE_SIGHT = 5; // extra tiles lit around a campfire at night

export class GameManager {
  private game: Phaser.Game | null = null;
  private gameLoop = new GameLoop();
  private scene: Phaser.Scene | null = null;
  private worldUnsubscribe: (() => void) | null = null;

  // Depth system:
  //   tiles=0, obj_shadow=ty*1000+1, obj=ty*1000+2, player=ty*1000+3
  //   fog=500_000, overlay=600_000, floatingText=700_000
  private tileGraphics: Phaser.GameObjects.Graphics | null = null;
  private playerGraphics: Phaser.GameObjects.Graphics | null = null;
  private fogGraphics: Phaser.GameObjects.Graphics | null = null;
  private dayNightRect: Phaser.GameObjects.Rectangle | null = null;
  private lightGraphics: Phaser.GameObjects.Graphics | null = null;

  // Individual y-sorted objects
  private resourceObjects = new Map<string, Phaser.GameObjects.Graphics>();
  private resourceQuantities = new Map<string, number>();
  private structureObjects = new Map<string, Phaser.GameObjects.Graphics>();
  private droppedItemObjects = new Map<string, Phaser.GameObjects.Graphics>();
  private fireGraphics: Phaser.GameObjects.Graphics | null = null;
  private shipwreckGraphics: Phaser.GameObjects.Graphics | null = null;
  private microsleepOverlay: Phaser.GameObjects.Rectangle | null = null;
  private awakeningOverlay: Phaser.GameObjects.Rectangle | null = null;
  private awakeningTimer = 0;
  private readonly AWAKENING_DURATION = 16000; // 16s total
  private awakeningPose = 0; // 0=lying, 1=standing
  private placementGraphics: Phaser.GameObjects.Graphics | null = null;
  private placementTileX = -1;
  private placementTileY = -1;
  private nextRainDay = -1;
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
  private cachedWorld: any = null;
  private lowHungerTicks = 0;

  private keyPressed = { space: false, e: false, f: false };
  private keys: any = null;
  private playerPx = 0;
  private playerPy = 0;
  private walkFrame = 0;
  private walkTimer = 0;
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
      const fresh = new WorldGenerator().generate(world.seed);
      world = { ...fresh, structures: world.structures, resources: world.resources, spawnX: world.spawnX ?? fresh.spawnX, spawnY: world.spawnY ?? fresh.spawnY };
      worldStoreState.initializeWorld(world);
    }

    const player = usePlayerStore.getState().player;

    // Init explored tiles grid
    this.exploredTiles = Array.from({ length: WORLD_CONFIG.height }, () =>
      new Array(WORLD_CONFIG.width).fill(false)
    );

    this.tileGraphics = this.scene.add.graphics().setDepth(0);
    this.renderTiles(world);

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
    this.fireGraphics = this.scene.add.graphics().setDepth(500);

    // Shipwreck — drawn once in world space, depth below player
    this.shipwreckGraphics = this.scene.add.graphics().setDepth(10);
    this.renderShipwreck(world);

    // Microsleep blackout overlay — sits above everything, tweened on stage 4 fatigue
    this.microsleepOverlay = this.scene.add.rectangle(
      0, 0, this.game!.scale.width, this.game!.scale.height, 0x000000
    ).setScrollFactor(0).setDepth(700_000).setOrigin(0, 0).setAlpha(0);

    // Placement preview graphics — drawn in world space above fog
    this.placementGraphics = this.scene.add.graphics().setDepth(600_500);

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

    // Reveal starting area — skip during awakening (fog expands gradually)
    if (!useGameStore.getState().isAwakening) {
      this.markExplored(player.x, player.y, SIGHT_DAY);
      this.updateFog(player.x, player.y, SIGHT_DAY);
    }

    this.worldUnsubscribe = useWorldStore.subscribe((state) => {
      if (state.world) {
        this.syncResources(state.world);
        this.syncStructures(state.world);
        this.syncDroppedItems(state.world);
      }
    });

    // Pause/resume GameLoop when store isPaused changes
    useGameStore.subscribe((state, prev) => {
      if (state.isPaused !== prev.isPaused) {
        if (state.isPaused) this.gameLoop.pause();
        else this.gameLoop.resume();
      }
    });

    this.setupInput();
    this.setupVisibilityPause();
  }

  private setupVisibilityPause() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.game?.loop.sleep();   // stop Phaser's RAF entirely
      this.gameLoop.pause();
    } else {
      this.game?.loop.wake();    // resume Phaser — no catch-up frames
      this.gameLoop.resume();
    }
  };

  // ── Tile rendering ────────────────────────────────────────────────

  private renderTiles(world: any) {
    this.cachedWorld = world;
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
      }
    }
    this.renderTileBlendingViewport(g, world, tx0, ty0, tx1, ty1);

    this.lastTileViewTx = Math.floor(cam.worldView.x / TS);
    this.lastTileViewTy = Math.floor(cam.worldView.y / TS);
  }

  // Biome color used for blending overlays
  private biomeBlendColor(type: string): number | null {
    switch (type) {
      case 'water':        return 0x1a6eb5;
      case 'beach': case 'sand': return 0xd4b87a;
      case 'grass':        return 0x2d8a3e;
      case 'tall_grass':   return 0x267a32;
      case 'sparse_forest': return 0x2a7030;
      case 'dense_jungle': return 0x0f3d14;
      case 'hills':        return 0x7a8a40;
      case 'mountain':     return 0x6a6050;
      case 'impassable':   return 0x2a2520;
      default:             return null;
    }
  }

  private renderTileBlendingViewport(g: Phaser.GameObjects.Graphics, world: any, tx0: number, ty0: number, tx1: number, ty1: number) {
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const here = world.tileMap[ty][tx].type;
        const x = tx * TS, y = ty * TS;
        if (tx + 1 <= tx1) {
          const right = world.tileMap[ty][tx + 1].type;
          if (right !== here) {
            const col = this.biomeBlendColor(right);
            if (col !== null) { g.fillStyle(col, 0.22); g.fillRect(x + TS - 7, y, 7, TS); }
          }
        }
        if (ty + 1 <= ty1) {
          const below = world.tileMap[ty + 1][tx].type;
          if (below !== here) {
            const col = this.biomeBlendColor(below);
            if (col !== null) { g.fillStyle(col, 0.22); g.fillRect(x, y + TS - 7, TS, 7); }
          }
        }
      }
    }
  }


  private drawTile(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number) {
    const x = tx * TS;
    const y = ty * TS;
    const hasCanopyTree = this.jungleCanopyTiles.has(`${tx},${ty}`);
    // Deterministic per-tile variation (no randomness, reproducible)
    const h = (tx * 7 + ty * 13) % 8;

    switch (type) {
      case 'grass': {
        g.fillStyle(0x2d8a3e);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x3aad50, 0.5);
        g.fillRect(x + (h * 3) % 20, y + (h * 5) % 20, 6, 4);
        g.fillStyle(0x1a6b28, 0.4);
        g.fillRect(x + (h * 11) % 22, y + (h * 7) % 18, 4, 6);
        break;
      }
      case 'water': {
        g.fillStyle(0x1a6eb5);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x3090d4, 0.45);
        g.fillRect(x, y + (h % 3) * 9, TS, 3);
        g.fillRect(x, y + (h % 3) * 9 + 5, TS, 2);
        break;
      }
      case 'sand': {
        g.fillStyle(0xd4a853);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0xe8c070, 0.4);
        g.fillCircle(x + 8 + (h * 4) % 14, y + 8 + (h * 7) % 14, 3);
        g.fillStyle(0xb88d3a, 0.3);
        g.fillCircle(x + 18 + (h * 3) % 10, y + 16 + (h * 5) % 12, 2);
        break;
      }
      case 'forest': {
        g.fillStyle(0x1a5c1a);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x2d8a2d, 0.9);
        g.fillCircle(x + 10 + (h % 3) * 4, y + 10 + (h % 2) * 5, 8);
        g.fillStyle(0x1f701f, 0.7);
        g.fillCircle(x + 20 - (h % 3) * 3, y + 18 + (h % 2) * 4, 7);
        break;
      }
      case 'rock': {
        g.fillStyle(0x787878);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x5a5a5a, 0.5);
        g.fillRect(x + 4 + (h % 4) * 3, y + 6, 10, 7);
        g.fillStyle(0x9a9a9a, 0.35);
        g.fillRect(x + 14, y + 4 + (h % 3) * 4, 8, 5);
        break;
      }

      // ── New biomes ───────────────────────────────────────────────────
      case 'beach': {
        g.fillStyle(0xd4b87a);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0xe8cc90, 0.5);
        g.fillCircle(x + 7  + (h * 4) % 16, y + 8  + (h * 7) % 14, 3);
        g.fillCircle(x + 20 + (h * 3) % 9,  y + 19 + (h * 5) % 10, 2);
        g.fillStyle(0xb89a50, 0.3);
        g.fillCircle(x + 14 + (h * 2) % 12, y + 14 + (h * 3) % 12, 2);
        // Beach micro-variation: shells, damp patches, drift traces
        if (h % 2 === 0) {
          g.fillStyle(0xf4e3be, 0.45);
          g.fillCircle(x + 5 + (h * 5) % 20, y + 22 - (h % 3) * 4, 1.8);
          g.fillCircle(x + 22 - (h * 2) % 9, y + 7 + (h % 4) * 3, 1.5);
        }
        if (h % 3 === 0) {
          g.fillStyle(0xb9a06a, 0.22);
          g.fillEllipse(x + 10 + (h * 3) % 12, y + 18, 14, 5);
        }
        if (h % 4 === 1) {
          g.fillStyle(0x9b7a45, 0.3);
          g.fillRect(x + 3 + (h * 2) % 18, y + 10 + (h % 3) * 4, 8, 2);
        }
        break;
      }
      case 'tall_grass': {
        g.fillStyle(0x267a32);
        g.fillRect(x, y, TS, TS);
        // Taller, denser blades with mixed tones
        g.lineStyle(1, 0x3db050, 0.92);
        for (let i = 0; i < 8; i++) {
          const bx = x + 4 + ((h * 5 + i * 7) % 22);
          g.lineBetween(bx, y + TS, bx + ((h + i) % 3) - 1, y + 2 + (i * 2) % 10);
        }
        g.lineStyle(1, 0x2f963e, 0.8);
        for (let i = 0; i < 4; i++) {
          const bx = x + 3 + ((h * 9 + i * 5) % 24);
          g.lineBetween(bx, y + TS - 1, bx - 1 + ((h + i) % 4), y + 6 + (i * 3) % 9);
        }
        g.fillStyle(0x1a5c24, 0.4);
        g.fillRect(x + (h * 9) % 18, y + (h * 7) % 18, 5, 8);
        // Wildflower accents
        if (h % 3 === 1) {
          g.fillStyle(0xeab308, 0.8);
          g.fillCircle(x + 8 + (h * 3) % 14, y + 9 + (h % 4) * 3, 1.5);
          g.fillStyle(0xf8fafc, 0.75);
          g.fillCircle(x + 20 - (h * 2) % 10, y + 13 + (h % 3) * 3, 1.2);
        }
        break;
      }
      case 'sparse_forest': {
        g.fillStyle(0x2a7030);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x3d9040, 0.7);
        g.fillCircle(x + 9  + (h % 3) * 5, y + 9  + (h % 2) * 6, 7);
        g.fillStyle(0x1f5c22, 0.5);
        g.fillCircle(x + 21 - (h % 3) * 4, y + 20 + (h % 2) * 4, 5);
        g.fillStyle(0x4aad54, 0.35);
        g.fillCircle(x + 15 + (h % 2) * 3, y + 7  + (h % 3) * 4, 4);
        break;
      }
      case 'dense_jungle': {
        // Darker, cooler jungle ground so canopy trees stand out clearly
        g.fillStyle(0x0a2a11);
        g.fillRect(x, y, TS, TS);
        if (hasCanopyTree) {
          g.fillStyle(0x12371a, 0.25);
          g.fillRect(x + 2, y + 2, TS - 4, TS - 4);
          break;
        }
        // Understory-only jungle tile: ferns, leaf clusters, damp patches
        g.fillStyle(0x0f3316, 0.55);
        g.fillEllipse(x + 8 + (h * 3) % 16, y + 9 + (h % 4) * 3, 12, 7);
        g.fillEllipse(x + 20 - (h * 2) % 11, y + 20 - (h % 3) * 2, 10, 6);

        g.fillStyle(0x1e5a2a, 0.6);
        g.fillRect(x + 3 + (h % 4) * 3, y + 18, 9, 3);
        g.fillRect(x + 14 + (h % 3) * 2, y + 22, 8, 2);

        g.lineStyle(1, 0x2f7f3a, 0.75);
        for (let i = 0; i < 4; i++) {
          const fx = x + 5 + ((h * 5 + i * 6) % 20);
          g.lineBetween(fx, y + 26, fx + ((i % 2) ? 2 : -2), y + 18 - (i % 3));
        }

        g.fillStyle(0x3f8a46, 0.35);
        g.fillCircle(x + 7 + (h * 4) % 16, y + 24 - (h % 3) * 2, 2);
        g.fillCircle(x + 22 - (h * 3) % 12, y + 12 + (h % 4) * 2, 1.8);
        break;
      }
      case 'hills': {
        g.fillStyle(0x7a8a40);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x9aaa50, 0.6);
        g.fillEllipse(x + 8  + (h * 3) % 14, y + 10 + (h % 3) * 4, 20, 10);
        g.fillStyle(0x5a6a30, 0.5);
        g.fillEllipse(x + 18 + (h * 2) % 10, y + 18 - (h % 2) * 3, 16,  8);
        g.fillStyle(0xb0c060, 0.25);
        g.fillRect(x + (h * 5) % 16, y + (h * 9) % 16, 6, 3);
        break;
      }
      case 'mountain': {
        g.fillStyle(0x6a6050);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x857a68, 0.7);
        g.fillRect(x + 2 + (h % 4) * 3, y + 4, 14, 10);
        g.fillStyle(0x504840, 0.6);
        g.fillRect(x + 8 + (h % 3) * 2, y + 14, 10,  8);
        g.fillStyle(0x9a9080, 0.35);
        g.fillRect(x + 4, y + 2 + (h % 3) * 3, 8, 4);
        // Snow hint on peaks
        g.fillStyle(0xffffff, 0.15);
        g.fillRect(x + 6 + (h % 4) * 2, y + 1, 6, 3);
        break;
      }
      case 'impassable': {
        g.fillStyle(0x2a2520);
        g.fillRect(x, y, TS, TS);
        g.fillStyle(0x3d3530, 0.8);
        g.fillRect(x + 1, y + 2, 14, 12);
        g.fillRect(x + 14, y + 8, 16, 18);
        g.fillStyle(0x1a1510, 0.6);
        g.fillRect(x + 5  + (h % 4) * 3, y + 3, 10, 7);
        g.fillRect(x + 8  + (h % 3) * 2, y + 16, 8, 10);
        // Ice/snow in cracks
        g.fillStyle(0xc0d0e0, 0.2);
        g.fillRect(x + (h * 3) % 20, y + (h * 5) % 20, 4, 2);
        break;
      }

      default: {
        g.fillStyle(0x555555);
        g.fillRect(x, y, TS, TS);
      }
    }

    // Per-tile lighting for more depth (no visible grid lines)
    const v = (tx * 23 + ty * 37) % 9;
    if (v < 2) { g.fillStyle(0x000000, 0.05); g.fillRect(x, y, TS, TS); }
    else if (v > 6) { g.fillStyle(0xffffff, 0.03); g.fillRect(x, y, TS, TS); }
    g.fillStyle(0xffffff, 0.04);
    g.fillRect(x + 1, y + 1, TS - 2, 2);
    g.fillStyle(0x000000, 0.08);
    g.fillRect(x + 1, y + TS - 3, TS - 2, 2);
  }

  // ── Resource & structure y-sorted objects ─────────────────────────

  private objectDepth(_tx: number, ty: number) {
    return ty * 1000 + 2;
  }

  private createResourceObject(res: any) {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    g.setDepth(this.objectDepth(res.x, res.y));
    this.drawResource(g, res.type, res.x, res.y, res.quantity);
    this.resourceQuantities.set(res.id, res.quantity);
    this.resourceObjects.set(res.id, g);
  }

  private createStructureObject(s: any) {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    g.setDepth(this.objectDepth(s.x, s.y));
    this.drawStructure(g, s.type, s.x, s.y, s.fuel);
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
    const baseX = tx * TS + TS / 2 + ((seed % 3) - 1) * 3;
    const baseY = ty * TS + TS - 2;
    const trunkH = 44 + (seed % 10); // taller trunk

    // Ground root spread
    g.fillStyle(0x3a2010, 0.7);
    g.fillEllipse(baseX, baseY + 2, 18, 6);
    g.fillStyle(0x4a7a3f, 0.4);
    g.fillEllipse(baseX, baseY + 1, 30, 10);

    // Ground shadow (cast shadow to the side, world-space depth)
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(baseX + 8, baseY + 4, 36, 10);

    // Main trunk — wider, darker
    g.fillStyle(0x4a2c15, 0.98);
    g.fillRect(baseX - 5, baseY - trunkH, 10, trunkH);
    // Bark highlight
    g.fillStyle(0x7a4b2b, 0.45);
    g.fillRect(baseX - 2, baseY - trunkH, 3, trunkH);
    // Root buttresses
    g.fillStyle(0x3d2010, 0.8);
    g.fillTriangle(baseX - 5, baseY, baseX - 12, baseY + 5, baseX - 5, baseY - 12);
    g.fillTriangle(baseX + 5, baseY, baseX + 12, baseY + 5, baseX + 5, baseY - 12);

    // Canopy — large, multi-layer, extends 1.5–2 tiles in all directions
    const cr = 26 + (seed % 6); // base canopy radius ~26-31px (~1 tile)
    const topY = baseY - trunkH;

    // Dark base layer (largest, lowest)
    g.fillStyle(0x0d3a11, 0.95);
    g.fillCircle(baseX, topY - 4, cr);
    // Secondary off-center lobes
    g.fillStyle(0x154a19, 0.92);
    g.fillCircle(baseX - cr * 0.6, topY - cr * 0.3, cr * 0.82);
    g.fillCircle(baseX + cr * 0.55, topY - cr * 0.25, cr * 0.78);
    g.fillCircle(baseX - cr * 0.2, topY - cr * 0.7, cr * 0.72);
    // Mid greens
    g.fillStyle(0x1f6123, 0.88);
    g.fillCircle(baseX + cr * 0.3, topY - cr * 0.55, cr * 0.65);
    g.fillCircle(baseX - cr * 0.45, topY - cr * 0.6, cr * 0.58);
    // Bright top highlights
    g.fillStyle(0x2f8734, 0.75);
    g.fillCircle(baseX - cr * 0.15, topY - cr * 0.85, cr * 0.45);
    g.fillCircle(baseX + cr * 0.2, topY - cr * 0.4, cr * 0.38);
    // Very bright tip
    g.fillStyle(0x3da040, 0.5);
    g.fillCircle(baseX, topY - cr, cr * 0.28);

    // Hanging vines from canopy
    const drawVine = (sx: number, sy: number, bend: number, len: number, col: number, alpha: number) => {
      g.lineStyle(1.5, col, alpha);
      let px = sx;
      let py = sy;
      for (let k = 1; k <= len; k++) {
        const nx = sx + Math.sin((k + bend) * 0.5) * bend * 1.1;
        const ny = sy + k * 2.2;
        g.lineBetween(px, py, nx, ny);
        px = nx; py = ny;
      }
      g.fillStyle(0x45ba4e, alpha * 0.9);
      g.fillCircle(px, py, 1.5);
    };

    if (!stripped) {
      const vineRootY = topY + cr * 0.2;
      drawVine(baseX - 8,  vineRootY,      1.8, 16, 0x2f8a36, 0.88);
      drawVine(baseX + 4,  vineRootY + 2,  2.3, 14, 0x3aa342, 0.80);
      drawVine(baseX - 18, vineRootY + 4,  1.4, 12, 0x2f8a36, 0.72);
      if (seed % 2 === 0) {
        drawVine(baseX + 14, vineRootY + 3, 1.9, 13, 0x38b040, 0.68);
      }
      if (seed % 3 === 0) {
        drawVine(baseX - 2,  vineRootY + 6, 2.5, 10, 0x2f8a36, 0.6);
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
      const alwaysShow = res.type === 'berry_bush' || res.type === 'exotic_fruit' || res.type === 'palm_tree';
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
          g.clear();
          this.drawResource(g, res.type, res.x, res.y, res.quantity);
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

  private drawResource(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number, quantity = 0) {
    const cx = tx * TS + TS / 2;
    // base = ground anchor at bottom of tile
    const base = ty * TS + TS - 4;

    // Deterministic per-tile size variation for trees (0.75 – 1.25)
    const treeSeed = (tx * 374761 + ty * 914723) % 100;
    const sc = 0.75 + treeSeed / 200; // 0.75 … 1.25

    switch (type) {
      case 'wood': {
        const th = Math.round(14 * sc);
        const cr = Math.round(13 * sc);
        g.fillStyle(0x000000, 0.22);
        g.fillEllipse(cx, base + 3, Math.round(22 * sc), Math.round(7 * sc));
        g.fillStyle(0x6b3a1f);
        g.fillRect(cx - Math.round(3 * sc), base - th, Math.round(6 * sc), th);
        g.fillStyle(0x4a2010, 0.5);
        g.fillRect(cx - Math.round(sc), base - th, Math.round(2 * sc), th);
        g.fillStyle(0x1a5c1a);
        g.fillCircle(cx, base - th - 12, cr);
        g.fillStyle(0x2d8a2d, 0.9);
        g.fillCircle(cx - Math.round(5 * sc), base - th - 18, Math.round(10 * sc));
        g.fillCircle(cx + Math.round(5 * sc), base - th - 18, Math.round(10 * sc));
        g.fillStyle(0x3aad50, 0.8);
        g.fillCircle(cx, base - th - 24, Math.round(9 * sc));
        g.fillStyle(0x4acc60, 0.4);
        g.fillCircle(cx - Math.round(2 * sc), base - th - 26, Math.round(5 * sc));
        break;
      }
      case 'stone': {
        // Shadow
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(cx, base + 2, 20, 6);
        // Rock body with slight height
        g.fillStyle(0x7a7a7a);
        g.fillEllipse(cx, base - 7, 22, 16);
        g.fillStyle(0xaaaaaa, 0.6);
        g.fillEllipse(cx - 4, base - 11, 12, 8);
        g.fillStyle(0x555555, 0.4);
        g.fillEllipse(cx + 5, base - 4, 9, 6);
        break;
      }
      case 'food': {
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(cx, base + 2, 18, 5);
        g.fillStyle(0x2d8a2d, 0.9);
        g.fillCircle(cx, base - 10, 10);
        g.fillStyle(0xe74c3c);
        g.fillCircle(cx - 4, base - 12, 3);
        g.fillCircle(cx + 4, base - 11, 3);
        g.fillCircle(cx, base - 6, 3);
        break;
      }
      case 'sticks': {
        g.lineStyle(2, 0x8b5e2a, 0.9);
        g.lineBetween(cx - 7, base, cx + 2, base - 8);
        g.lineBetween(cx - 2, base + 1, cx + 6, base - 6);
        g.lineBetween(cx - 5, base - 2, cx + 4, base - 4);
        break;
      }
      case 'pebbles': {
        g.fillStyle(0x9a9a9a);
        g.fillCircle(cx - 5, base - 1, 3);
        g.fillStyle(0xb0b0b0);
        g.fillCircle(cx + 4, base - 2, 3.5);
        g.fillStyle(0x888888);
        g.fillCircle(cx, base - 6, 2.5);
        break;
      }
      case 'palm_tree': {
        const th = Math.round(30 * sc);
        // Shadow
        g.fillStyle(0x000000, 0.20);
        g.fillEllipse(cx, base + 3, Math.round(18 * sc), Math.round(6 * sc));
        // Trunk
        g.fillStyle(0x8b6914);
        g.fillRect(cx - Math.round(2 * sc), base - th, Math.round(5 * sc), th);
        g.fillStyle(0xa07820, 0.6);
        g.fillRect(cx - Math.round(sc), base - th, Math.round(2 * sc), th);
        g.fillStyle(0x6b5010, 0.4);
        for (let i = 0; i < 5; i++) {
          g.fillRect(cx - Math.round(2 * sc), base - Math.round(6 * sc) - i * Math.round(6 * sc), Math.round(5 * sc), 2);
        }
        // Fronds — smooth leaf polygons with quadratic droop
        const top = base - th;
        const fLen = Math.round(22 * sc);
        // Draws a natural leaf shape: wide belly, tapers to 0 at both ends,
        // with the tip pulled downward by `droop` pixels (quadratic gravity curve)
        const drawFrond = (angleDeg: number, droop: number, color: number, alpha: number, lenMult = 1.0) => {
          const rad = angleDeg * Math.PI / 180;
          const len = fLen * lenMult;
          const cosA = Math.cos(rad), sinA = Math.sin(rad);
          // perpendicular to the frond axis (for width)
          const nx = -sinA, ny = cosA;
          const maxHW = 4.5 * sc;
          const N = 10;
          const pts: { x: number; y: number }[] = [];
          // right side: base → tip
          for (let i = 0; i <= N; i++) {
            const t = i / N;
            const sx = cx + cosA * len * t;
            const sy = top + sinA * len * t + droop * sc * t * t; // quadratic droop
            const hw = maxHW * Math.sin(t * Math.PI); // 0 at both ends, peak at midpoint
            pts.push({ x: sx + nx * hw, y: sy + ny * hw });
          }
          // left side: tip → base
          for (let i = N; i >= 0; i--) {
            const t = i / N;
            const sx = cx + cosA * len * t;
            const sy = top + sinA * len * t + droop * sc * t * t;
            const hw = maxHW * Math.sin(t * Math.PI);
            pts.push({ x: sx - nx * hw, y: sy - ny * hw });
          }
          g.fillStyle(color, alpha);
          g.fillPoints(pts, true);
          // midrib: thin lighter strip along spine
          const rib: { x: number; y: number }[] = [];
          const rw = 0.8 * sc;
          for (let i = 0; i <= N; i++) {
            const t = i / N;
            rib.push({ x: cx + cosA*len*t + nx*rw, y: top + sinA*len*t + droop*sc*t*t + ny*rw });
          }
          for (let i = N; i >= 0; i--) {
            const t = i / N;
            rib.push({ x: cx + cosA*len*t - nx*rw, y: top + sinA*len*t + droop*sc*t*t - ny*rw });
          }
          g.fillStyle(0x7ee830, alpha * 0.45);
          g.fillPoints(rib, true);
        };
        // Crown knob
        g.fillStyle(0x4a7a10, 1.0);
        g.fillCircle(cx, top, Math.round(3 * sc));
        // Always-visible: 3 upward fronds
        drawFrond(-90,   2, 0x33b01e, 0.95);
        drawFrond(-120,  6, 0x2ca01a, 0.92, 0.95);
        drawFrond(-60,   6, 0x2ca01a, 0.92, 0.95);
        // Mid fronds (qty >= 3): spread sideways, moderate droop
        if (quantity >= 3) {
          drawFrond(-150, 12, 0x259016, 0.85, 0.92);
          drawFrond(-30,  12, 0x259016, 0.85, 0.92);
        }
        // Lower drooping fronds (qty >= 1): hang below crown
        if (quantity >= 1) {
          drawFrond(-170, 20, 0x1e7812, 0.78, 0.88);
          drawFrond(-10,  20, 0x1e7812, 0.78, 0.88);
        }
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
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(cx, base + 2, 18, 5);
        g.fillStyle(0x4a4040);
        g.fillEllipse(cx, base - 8, 20, 14);
        g.fillStyle(0xb45309, 0.9);
        g.fillEllipse(cx - 3, base - 10, 6, 4);
        g.fillStyle(0xd97706, 0.7);
        g.fillEllipse(cx + 4, base - 6, 4, 3);
        break;
      }

      case 'obsidian': {
        // Glassy black volcanic rock — sharp angular shards
        g.fillStyle(0x000000, 0.25);
        g.fillEllipse(cx, base + 2, 20, 6);
        g.fillStyle(0x0d0d12);
        g.fillEllipse(cx, base - 8, 20, 14);
        g.fillStyle(0x1a1a2e, 0.9);
        g.fillEllipse(cx - 3, base - 12, 8, 5);
        // Glassy highlight
        g.fillStyle(0x6060a0, 0.6);
        g.fillRect(cx - 5, base - 14, 4, 2);
        g.fillStyle(0x9090d0, 0.4);
        g.fillRect(cx - 4, base - 15, 2, 1);
        break;
      }
      case 'granite': {
        // Grey speckled granite boulder
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(cx, base + 2, 24, 7);
        g.fillStyle(0x8a8a8a);
        g.fillEllipse(cx, base - 9, 24, 18);
        g.fillStyle(0xb0b0b0, 0.5);
        g.fillEllipse(cx - 5, base - 14, 12, 8);
        // Pink feldspar specks
        g.fillStyle(0xc89090, 0.5);
        g.fillCircle(cx + 3, base - 8, 2);
        g.fillCircle(cx - 6, base - 6, 2);
        // Dark mica flecks
        g.fillStyle(0x333333, 0.4);
        g.fillCircle(cx + 6, base - 12, 1);
        g.fillCircle(cx - 2, base - 5, 1);
        g.fillStyle(0x606060, 0.4);
        g.fillEllipse(cx + 5, base - 4, 8, 5);
        break;
      }

      // ── New resources (base-anchored) ─────────────────────────────────
      case 'flint': {
        g.fillStyle(0x3a3530);
        g.fillRect(cx - 5, base - 5, 10, 6);
        g.fillStyle(0x706860, 0.9);
        g.fillRect(cx - 4, base - 7, 6, 4);
        g.fillStyle(0xd0c8b8, 0.7);
        g.fillRect(cx - 3, base - 9, 3, 2);
        g.lineStyle(1, 0x908878, 0.8);
        g.lineBetween(cx - 5, base - 4, cx + 2, base - 8);
        break;
      }
      case 'driftwood': {
        g.fillStyle(0xb8a888);
        g.fillRect(cx - 8, base - 3, 16, 5);
        g.fillStyle(0xd0bea0, 0.6);
        g.fillRect(cx - 6, base - 4, 10, 3);
        g.fillStyle(0x907860, 0.5);
        g.fillRect(cx - 3, base, 6, 3);
        break;
      }
      case 'shells': {
        g.fillStyle(0xf0e8d8);
        g.fillEllipse(cx - 4, base - 2, 8, 5);
        g.fillStyle(0xe8dfc8, 0.9);
        g.fillEllipse(cx + 4, base - 4, 7, 4);
        g.fillStyle(0xfff8ee, 0.8);
        g.fillEllipse(cx, base, 6, 4);
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
      case 'herbs': {
        g.fillStyle(0x2aaa50, 0.9);
        g.fillCircle(cx, base - 10, 5);
        g.fillStyle(0x3acc60, 0.7);
        g.fillCircle(cx - 4, base - 6, 3);
        g.fillCircle(cx + 4, base - 6, 3);
        g.lineStyle(1, 0x1a7838, 0.9);
        g.lineBetween(cx, base, cx, base - 8);
        break;
      }
      case 'fiber': {
        g.lineStyle(2, 0xc8b060, 0.9);
        g.lineBetween(cx - 5, base + 2, cx - 3, base - 8);
        g.lineBetween(cx - 1, base + 2, cx + 1, base - 9);
        g.lineBetween(cx + 4, base + 2, cx + 3, base - 7);
        g.lineStyle(1, 0xe0c870, 0.7);
        g.lineBetween(cx - 3, base + 2, cx - 1, base - 7);
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
        const th = Math.round(18 * sc);
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(cx, base + 2, Math.round(22 * sc), Math.round(5 * sc));
        g.fillStyle(0x4a2a10);
        g.fillRect(cx - Math.round(4*sc), base - th, Math.round(8*sc), th);
        g.fillStyle(0xd4820a, 0.9);
        g.fillRect(cx - Math.round(2*sc), base - Math.round(14*sc), Math.round(3*sc), Math.round(6*sc));
        g.fillStyle(0xf0a020, 0.7);
        g.fillRect(cx + Math.round(sc),   base - Math.round(10*sc), Math.round(2*sc), Math.round(4*sc));
        g.fillStyle(0x1e5010);
        g.fillCircle(cx, base - th - 4, Math.round(9*sc));
        g.fillStyle(0x285c18, 0.8);
        g.fillCircle(cx - Math.round(4*sc), base - th,     Math.round(6*sc));
        g.fillCircle(cx + Math.round(4*sc), base - th - 2, Math.round(6*sc));
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
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(cx, base + 2, Math.round(22*sc), Math.round(5*sc));
        const seed2 = (tx * 7 + ty * 13) % 5;
        const halms = [
          { ox: -6,  h: 38 + seed2 * 2,    w: 4 },
          { ox:  4,  h: 34 + (seed2+1) * 2, w: 3.5 },
          { ox: -1,  h: 42 + seed2,          w: 4 },
          { ox:  9,  h: 28 + seed2 * 3,     w: 3 },
          { ox: -10, h: 30 + seed2,          w: 3 },
        ];
        for (const h of halms) {
          const hx = cx + Math.round(h.ox * sc);
          const hh = Math.round(h.h * sc);
          const hw = Math.max(2, Math.round(h.w * sc));
          const segH = Math.round(8 * sc);
          const segments = Math.floor(hh / segH);
          g.fillStyle(0x4a9020, 0.92);
          g.fillRect(hx - hw / 2, base - hh, hw, hh);
          g.fillStyle(0x6ab830, 0.45);
          g.fillRect(hx - hw / 2 + 0.5, base - hh, hw * 0.4, hh);
          g.fillStyle(0x386010, 0.7);
          for (let s = 1; s < segments; s++) {
            g.fillRect(hx - hw / 2 - 1, base - s * segH, hw + 2, 1.5);
          }
          g.fillStyle(0x50a828, 0.85);
          g.fillTriangle(hx, base - hh - Math.round(10*sc), hx - Math.round(8*sc), base - hh + Math.round(2*sc), hx + Math.round(2*sc), base - hh + Math.round(4*sc));
          g.fillTriangle(hx, base - hh - Math.round(8*sc),  hx + Math.round(9*sc), base - hh + Math.round(3*sc), hx - Math.round(sc),    base - hh + Math.round(5*sc));
          g.fillStyle(0x68c038, 0.6);
          g.fillTriangle(hx - Math.round(2*sc), base - hh - Math.round(6*sc), hx - Math.round(10*sc), base - hh + Math.round(6*sc), hx + Math.round(2*sc), base - hh + Math.round(2*sc));
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
        // Half coconut shell on the ground
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
    }
  }

  private drawStructure(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number, fuel?: number) {
    const cx  = tx * TS + TS / 2;
    const base = ty * TS + TS - 2; // ground anchor

    if (type === 'storage_spot') {
      const top = ty * TS + 4;
      const left = tx * TS + 4;
      const right = tx * TS + TS - 4;
      const bot = ty * TS + TS - 4;
      const cLen = 6; // corner line length
      // Ground fill — subtle dirt patch
      g.fillStyle(0x8b6b3d, 0.25);
      g.fillRect(left, top, right - left, bot - top);
      // Dashed border via corner markers
      g.lineStyle(2, 0xc8a05a, 0.85);
      // Top-left
      g.lineBetween(left, top, left + cLen, top);
      g.lineBetween(left, top, left, top + cLen);
      // Top-right
      g.lineBetween(right, top, right - cLen, top);
      g.lineBetween(right, top, right, top + cLen);
      // Bottom-left
      g.lineBetween(left, bot, left + cLen, bot);
      g.lineBetween(left, bot, left, bot - cLen);
      // Bottom-right
      g.lineBetween(right, bot, right - cLen, bot);
      g.lineBetween(right, bot, right, bot - cLen);
      // Center dot
      g.fillStyle(0xc8a05a, 0.5);
      g.fillCircle(cx, ty * TS + TS / 2, 2);

    } else if (type === 'sleeping_spot') {
      // Soft palm-leaf mat on the ground
      const top  = ty * TS + 6;
      const left = tx * TS + 3;
      const w    = TS - 6;
      const h    = TS - 10;
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(cx, base + 2, w + 4, 6);
      // Mat base — warm sandy tone
      g.fillStyle(0x8fba40, 0.55);
      g.fillRoundedRect(left, top, w, h, 4);
      // Leaf texture lines
      g.lineStyle(1, 0x5a8a20, 0.6);
      for (let i = 0; i < 4; i++) {
        const lx = left + 4 + i * ((w - 8) / 3);
        g.lineBetween(lx, top + 3, lx + 2, top + h - 3);
      }
      // Border
      g.lineStyle(1, 0x6aaa30, 0.8);
      g.strokeRoundedRect(left, top, w, h, 4);

    } else if (type === 'palm_shelter') {
      // 2 tiles wide — cx is center of the full 2-tile span
      const w2 = TS; // half of 2-tile span = 1 tile
      // Shadow
      g.fillStyle(0x000000, 0.2);
      g.fillEllipse(cx, base + 3, 58, 10);
      // Back wall (palm leaves woven together)
      g.fillStyle(0x4a7a18);
      g.fillRect(cx - w2, base - 30, w2 * 2, 30);
      // Leaf texture stripes
      g.fillStyle(0x5a9020, 0.5);
      for (let i = 0; i < 5; i++) {
        g.fillRect(cx - w2 + 4 + i * 12, base - 30, 5, 30);
      }
      // Roof (wide triangle)
      g.fillStyle(0x3a6a10);
      g.fillTriangle(cx - w2 - 6, base - 28, cx, base - 52, cx + w2 + 6, base - 28);
      g.fillStyle(0x4a8a18);
      g.fillTriangle(cx - w2, base - 28, cx, base - 48, cx + w2, base - 28);
      // Roof highlight
      g.fillStyle(0x5aa020, 0.6);
      g.fillTriangle(cx - w2 + 6, base - 28, cx, base - 44, cx + w2 - 6, base - 28);
      // Two support posts
      g.fillStyle(0x7a5a28);
      g.fillRect(cx - w2 + 4, base - 28, 7, 28);
      g.fillRect(cx + w2 - 11, base - 28, 7, 28);
      // Vine lashings
      g.fillStyle(0x5a4a20);
      g.fillRect(cx - w2 + 2, base - 20, 12, 3);
      g.fillRect(cx + w2 - 14, base - 20, 12, 3);
      // Open front (dark interior)
      g.fillStyle(0x0a0a05, 0.65);
      g.fillRect(cx - w2 + 14, base - 26, w2 * 2 - 28, 26);

    } else if (type === 'campfire') {
      // Shadow
      g.fillStyle(0x000000, 0.2);
      g.fillEllipse(cx, base + 1, 22, 6);
      // Stone ring
      g.fillStyle(0x777777);
      g.fillCircle(cx - 7, base - 2, 4);
      g.fillCircle(cx + 7, base - 2, 4);
      g.fillCircle(cx, base + 1,    4);
      g.fillStyle(0x999999, 0.7);
      g.fillCircle(cx - 7, base - 3, 2.5);
      g.fillCircle(cx + 6, base - 3, 2.5);
      // Logs
      g.fillStyle(0x5c3317);
      g.fillRect(cx - 8, base - 4, 16, 4);
      g.fillStyle(0x7a4a28, 0.6);
      g.fillRect(cx - 6, base - 5, 12, 3);
      // Embers (always visible even without fuel)
      g.fillStyle(0x8b2500, 0.9);
      g.fillCircle(cx - 2, base - 5, 2.5);
      g.fillCircle(cx + 3, base - 5, 2);

    } else if (type === 'water_container') {
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

    // Walk-cycle offsets
    const f = this.walkFrame;
    // Body bob: frames 1&3 bob up 1px
    const bob = (f === 1 || f === 3) ? -1 : 0;
    // Leg offsets: [leftFwd, rightFwd] per frame
    const legFwd  = [0, 3, 0, -3];  // left leg forward offset
    const legBack = [0, -3, 0, 3];  // right leg forward offset
    // Arm swing (opposite to legs)
    const armFwd  = [0, -2, 0, 2];
    const armBack = [0, 2, 0, -2];

    // Update y-sort depth so player walks behind tall objects
    const tileY = Math.floor(this.playerPy / TS);
    g.setDepth(tileY * 1000 + 3);

    g.clear();

    // Drop shadow (flattens when bobbing)
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx, cy + 10, 18, 7 - Math.abs(bob));

    // ── Legs ──────────────────────────────────────────────────────────
    g.fillStyle(0x2c3e50);
    if (direction === 'left' || direction === 'right') {
      // Side view: legs fore/back
      g.fillRect(cx - 3, cy + 6 + bob, 5, 7 + legFwd[f]);
      g.fillStyle(0x1a252f);
      g.fillRect(cx + 0, cy + 6 + bob, 4, 7 + legBack[f]);
    } else {
      // Front/back: legs side by side
      g.fillRect(cx - 4, cy + 6 + bob, 4, 6 + legFwd[f]);
      g.fillStyle(0x1a252f);
      g.fillRect(cx + 1, cy + 6 + bob, 4, 6 + legBack[f]);
    }

    // ── Body (shirt) ──────────────────────────────────────────────────
    g.fillStyle(0x2471a3);
    g.fillRect(cx - 5, cy - 2 + bob, 10, 9);
    // Shirt detail
    g.fillStyle(0x1a5f8a, 0.6);
    g.fillRect(cx - 1, cy - 1 + bob, 2, 7);

    // ── Arms ─────────────────────────────────────────────────────────
    g.fillStyle(0xfde3a7);
    if (direction === 'left' || direction === 'right') {
      g.fillRect(cx - 7, cy - 1 + bob + armFwd[f], 3, 6);
      g.fillRect(cx + 4, cy - 1 + bob + armBack[f], 3, 6);
    } else {
      g.fillRect(cx - 7, cy - 1 + bob + armFwd[f], 3, 7);
      g.fillRect(cx + 4, cy - 1 + bob + armBack[f], 3, 7);
    }

    // ── Head ─────────────────────────────────────────────────────────
    g.fillStyle(0xfde3a7);
    g.fillCircle(cx, cy - 5 + bob, 6);

    // ── Hair ─────────────────────────────────────────────────────────
    g.fillStyle(0x5d3e2a);
    g.fillCircle(cx, cy - 10 + bob, 5);
    g.fillRect(cx - 5, cy - 11 + bob, 10, 4);
    if (direction !== 'up') {
      // Side/front hair fringe
      g.fillRect(cx - 5, cy - 9 + bob, 3, 3);
    }

    // ── Eyes / face ──────────────────────────────────────────────────
    if (direction !== 'up') {
      g.fillStyle(0x2c1810);
      if (direction === 'left') {
        g.fillCircle(cx - 3, cy - 5 + bob, 1.2);
        // Mouth hint
        g.fillStyle(0xc07060, 0.7);
        g.fillRect(cx - 5, cy - 3 + bob, 3, 1);
      } else if (direction === 'right') {
        g.fillCircle(cx + 3, cy - 5 + bob, 1.2);
        g.fillStyle(0xc07060, 0.7);
        g.fillRect(cx + 2, cy - 3 + bob, 3, 1);
      } else {
        g.fillCircle(cx - 2, cy - 5 + bob, 1.2);
        g.fillCircle(cx + 2, cy - 5 + bob, 1.2);
        g.fillStyle(0xc07060, 0.7);
        g.fillRect(cx - 2, cy - 3 + bob, 4, 1);
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
    const litCampfires = useWorldStore.getState().world?.structures.filter(
      s => s.type === 'campfire' && (s.fuel ?? 0) > 0
    ) ?? [];

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

      } else {
        // === NO FUEL: just glowing embers, no flames ===
        const glow = 0.3 + Math.sin(t / 800 + cf.x) * 0.15;
        fg.fillStyle(0xff2200, glow);
        fg.fillCircle(wx - 2, wy - 4, 2.5);
        fg.fillCircle(wx + 3, wy - 4, 2);
        fg.fillStyle(0xff6600, glow * 0.6);
        fg.fillCircle(wx,     wy - 5, 1.5);
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

  private onUpdate(rawDelta: number) {
    if (!this.scene) return;

    // Skip frames after tab return to let WebGL context stabilise
    if (this.skipFrames > 0) {
      this.skipFrames--;
      return;
    }

    // Cap delta to prevent huge catch-up after tab becomes inactive
    const delta = Math.min(rawDelta, 100);

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
      this.updateSpearLunge(delta);
      this.updateFatigueEffects(delta);
      this.updatePlayerMovement(delta);
    }

    this.gameLoop.update(delta);
    const tick = this.gameLoop.isTickReady();

    if (!awakening) {
      this.gatherResource();
      this.interactStructure();
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
    const hasKnife = handIds.some(id => ['shell_knife','flint_knife','stone_axe','improved_axe','iron_axe'].includes(id));
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
    for (const grant of RAIN_KNOWLEDGE_GRANTS) {
      if (grant.needsAny.some(m => knownMaterials.includes(m))) {
        learnKnowledge(grant.flag);
      }
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
            if (hasWeapon) { // only with a blade
              useWorldStore.getState().dropItem('hide', 1, tx, ty);
              if (Math.random() > 0.4) useWorldStore.getState().dropItem('fat', 1, tx, ty);
            }
            this.spawnFloatingText('🐗 Erlegt! Fleisch + Knochen', tx, ty - 1, '#f97316');
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

      turtle.g.setDepth(Math.floor(turtle.py / TS) * 1000 + 2);
      this.drawTurtle(turtle);
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
            const hasKnife = handIds.some(id => ['shell_knife','flint_knife','stone_axe','improved_axe','iron_axe'].includes(id as string));
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
      crab.g.setDepth(Math.floor(crab.py / TS) * 1000 + 2);
      this.drawCrab(crab);
    }
  }

  // Width in tiles for structures that occupy more than 1 tile
  private getStructureWidth(recipeId: string): number {
    return recipeId === 'palm_shelter' ? 2 : 1;
  }

  private isValidPlacement(recipeId: string, tx: number, ty: number): boolean {
    const world = useWorldStore.getState().world;
    if (!world) return false;
    const w = this.getStructureWidth(recipeId);
    for (let dx = 0; dx < w; dx++) {
      const x = tx + dx;
      const y = ty;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
      const tile = world.tileMap[y]?.[x];
      if (!tile?.walkable) return false;
      if (world.structures.some(s => {
        const sw = s.width ?? 1;
        return s.y === y && x >= s.x && x < s.x + sw;
      })) return false;
    }
    return true;
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

    const { player, removeResource } = usePlayerStore.getState();
    const inv = player.inventory;

    // BuildDefinition path (no recipe needed — materials consumed directly)
    const buildDef = BUILD_DEFINITIONS.find(d => d.id === recipeId);
    if (buildDef) {
      // Check materials
      for (const m of buildDef.requiredMaterials) {
        const have = inv.items.find(i => i.resourceId === m.item)?.quantity ?? 0;
        if (have < m.amount) return;
      }
      for (const m of buildDef.requiredMaterials) removeResource(m.item, m.amount);
      useWorldStore.getState().placeStructure(recipeId, tx, ty);
      if (buildDef.grantsKnowledge) {
        for (const flag of buildDef.grantsKnowledge) {
          usePlayerStore.getState().learnKnowledge(flag as KnowledgeFlag);
        }
      }
      useGameStore.getState().addScore(150);
      useGameStore.getState().exitPlacementMode();
      if (this.placementGraphics) this.placementGraphics.clear();
      return;
    }

    // Recipe path (legacy — Crafting-Modal structures like campfire etc.)
    if (!craftingSystem.canCraft(recipeId, inv)) return;
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    for (const input of recipe.inputs) removeResource(input.resourceId, input.quantity);

    const CONSTRUCTION_DAYS: Record<string, number> = { wooden_shelter: 2, log_cabin: 4 };
    const structureType = recipe.outputs[0]?.resourceId ?? recipeId;
    const days = CONSTRUCTION_DAYS[recipeId];
    if (days) {
      useWorldStore.getState().placeConstructionSite(structureType, tx, ty, days);
    } else {
      useWorldStore.getState().placeStructure(structureType, tx, ty);
    }

    useGameStore.getState().addScore(200);
    useGameStore.getState().exitPlacementMode();
    if (this.placementGraphics) this.placementGraphics.clear();
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
      this.walkTimer = 0;
      return;
    }

    // Speed maluses — stack multiplicatively
    const fStage = this.getFatigueStage(fatigue);
    let speedMult = 1.0;
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
      this.walkTimer = 0;
      return;
    }

    // Close gather menu on movement
    if (useGameStore.getState().gatherMenuOpen) {
      useGameStore.getState().closeGatherMenu();
    }

    // Walk animation timer
    this.walkTimer += delta;
    if (this.walkTimer >= 140) {
      this.walkFrame = (this.walkFrame + 1) % 4;
      this.walkTimer = 0;
    }

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    vx *= SPEED * delta / 1000;
    vy *= SPEED * delta / 1000;

    // Try X movement — check tile at leading edge
    const newPx = this.playerPx + vx;
    const edgeTileX = Math.floor((newPx + (vx > 0 ? TS - 1 : 0)) / TS);
    const curTileY = Math.floor((this.playerPy + TS / 2) / TS);
    if (worldState.getTile(edgeTileX, curTileY)?.walkable) {
      this.playerPx = Math.max(0, Math.min((WORLD_CONFIG.width - 1) * TS, newPx));
    }

    // Try Y movement
    const curTileX = Math.floor((this.playerPx + TS / 2) / TS);
    const newPy = this.playerPy + vy;
    const edgeTileY = Math.floor((newPy + (vy > 0 ? TS - 1 : 0)) / TS);
    if (worldState.getTile(curTileX, edgeTileY)?.walkable) {
      this.playerPy = Math.max(0, Math.min((WORLD_CONFIG.height - 1) * TS, newPy));
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
    const distMoved = Math.sqrt(vx * vx + vy * vy);
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

    const newHealth = Math.max(0, health - healthDrain);
    const newThirstFinal = Math.min(100, newThirst + extraThirst);
    const newHungerFinal = Math.min(100, newHunger + extraHunger);

    updateStats({ health: newHealth, hunger: newHungerFinal, thirst: newThirstFinal, stamina: newStamina, fatigue: newFatigue });

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

      // Schedule first rain on day 2, then every 3–6 days randomly
      if (this.nextRainDay === -1) {
        this.nextRainDay = 2;
      } else if (currentDay >= this.nextRainDay && !this.isRaining) {
        this.pickRainType();
        this.isRaining = true;
        this.rainTimer = 0;
        const containers = worldState.world?.structures.filter(s => s.type === 'water_container') ?? [];
        for (const c of containers) worldState.updateStructure(c.id, { fuel: 2 });
        if (GameManager.FIRE_EXTINGUISHING_TYPES.has(this.rainType)) this.extinguishCampfires();
        this.nextRainDay = currentDay + 3 + Math.floor(Math.random() * 4);
        this.checkRainKnowledge();
      }
    }
    this.lastGameDay = currentDay;

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
      const stillNearby = useWorldStore.getState().world?.resources.filter(r =>
        r.quantity > 0 && Math.abs(r.x - x) <= 1 && Math.abs(r.y - y) <= 1
      ) ?? [];
      if (stillNearby.length > 0) gameState.openGatherMenu(stillNearby);
      else gameState.closeGatherMenu();
      return;
    }

    // Space pressed: scan nearby resources and open menu
    if (!this.keyPressed.space) return;
    this.keyPressed.space = false;

    const { x, y } = player;
    const nearby = worldState.world.resources.filter(r =>
      r.quantity > 0 &&
      Math.abs(r.x - x) <= 1 &&
      Math.abs(r.y - y) <= 1
    );
    if (nearby.length === 0) return;
    gameState.openGatherMenu(nearby);
  }

  private executeGather(resource: any, player: any, addToInventory: any, worldState: any, action: string | null = null) {

    // Always read fresh player state so equipment changes are reflected immediately
    const freshPlayer = usePlayerStore.getState().player;

    // Tool bonus: only equipped hand slots count (Option B)
    const eq = freshPlayer.equipment ?? { leftHand: null, rightHand: null };
    const handIds = [eq.leftHand?.resourceId, eq.rightHand?.resourceId].filter(Boolean) as string[];
    const hasFlintKnife  = handIds.includes('flint_knife') || handIds.includes('shell_knife');
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
    const giveType = action === 'sticks'              ? 'sticks'
                   : action === 'coconut'             ? 'coconut'
                   : resource.type === 'spring'       ? 'water'
                   : resource.type === 'palm_tree'    ? 'palm_leaf'
                   : resource.type === 'resin_tree'   ? 'tree_resin'
                   : resource.type === 'berry_bush'   ? 'food'
                   : resource.type;

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
          if (handIds.includes(toolId)) { damageTool(toolId, dmg); break; }
        }
      }

      // Award gather skill XP
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

      const site = structures.find(s => s.type === 'construction_site' && Math.abs(s.x - player.x) <= 1 && Math.abs(s.y - player.y) <= 1);
      if (site) {
        const currentDay = Math.floor(useGameStore.getState().elapsedTime / DAY_DURATION_MS);
        const progressed = worldState.progressConstruction(site.id, currentDay);
        if (!progressed) {
          this.spawnFloatingText('Heute schon gearbeitet 🛠️', player.x, player.y, '#f97316');
        } else {
          const updated = useWorldStore.getState().world?.structures.find(s => s.id === site.id);
          if (!updated || updated.type !== 'construction_site') {
            this.spawnFloatingText('Fertig! 🏠', player.x, player.y, '#86efac');
          } else {
            this.spawnFloatingText(`Arbeit getan – noch ${updated.constructionDaysLeft} Tag(e) 🛠️`, player.x, player.y, '#fbbf24');
          }
        }
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

    const res = world.resources.find(r => r.x === tx && r.y === ty && r.quantity > 0) ?? null;
    useGameStore.getState().setHoveredResource(res);
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
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.worldUnsubscribe?.();
    this.gameLoop.reset();
    this.game?.destroy(true);
    this.game = null;
    this.scene = null;
    this.playerGraphics = null;
    this.tileGraphics = null;
    this.fogGraphics = null;
    this.dayNightRect = null;
    this.lightGraphics = null;
    this.fireGraphics = null;
    this.jungleTreeObjects = [];
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
        const hasWeapon = atkHands.some(id => ['stone_spear','shell_knife','flint_knife','stone_axe','improved_axe','iron_axe'].includes(id));
        const dmg = hasWeapon ? (25 + Math.random() * 10) : (5 + Math.random() * 3);
        boar.health = Math.max(0, boar.health - dmg);
        boar.hitFlash = 250;
        this.spawnFloatingText(`-${Math.round(dmg)}`, Math.floor(boar.px / TS), Math.floor(boar.py / TS), '#ff4444');
        // Damage weapon on hit
        if (hasWeapon) {
          const weaponId = atkHands.find(id => ['stone_spear','shell_knife','flint_knife','stone_axe','improved_axe','iron_axe'].includes(id));
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
      this.drawBoar(boar);
    }
  }
}
