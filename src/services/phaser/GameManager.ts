import Phaser from 'phaser';
import { GameLoop } from '../game/GameLoop';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { WORLD_CONFIG, DAY_DURATION_MS } from '../../data/worldConfig';
import { WorldGenerator } from './WorldGenerator';
import { RECIPES } from '../../data/recipes';
import { useTutorialStore } from '../../store/tutorialStore';
import { craftingSystem } from '../game/CraftingSystem';
import { FootstepAudio } from '../game/FootstepAudio';

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
  private structureObjects = new Map<string, Phaser.GameObjects.Graphics>();
  private fireGraphics: Phaser.GameObjects.Graphics | null = null;
  private microsleepOverlay: Phaser.GameObjects.Rectangle | null = null;
  private placementGraphics: Phaser.GameObjects.Graphics | null = null;
  private placementTileX = -1;
  private placementTileY = -1;

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

  // Spear projectiles
  private spears: {
    id: string;
    px: number; py: number;      // world-space position (center of spear)
    vx: number; vy: number;      // velocity px/s
    angle: number;               // radians, for drawing
    traveledPx: number;          // distance covered so far
    maxRangePx: number;
    g: Phaser.GameObjects.Graphics;
  }[] = [];

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

  // Stumble (Übermüdet+): freeze movement briefly at random intervals
  private stumbleFreezeMs  = 0;
  private stumbleTimer     = 0;
  private nextStumbleAt    = 7000; // ms until next stumble check

  // Microsleep (Sekundenschlaf): flash to black every ~8s
  private microsleepTimer  = 0;
  private readonly MICROSLEEP_INTERVAL = 8000;
  private jungleTreeObjects: Phaser.GameObjects.Graphics[] = [];
  private jungleCanopyTiles = new Set<string>();
  private jungleCanopyMeta = new Map<string, { tx: number; ty: number; seed: number; stripped: boolean; g: Phaser.GameObjects.Graphics }>();
  private vineTreeByResourceId = new Map<string, string>();

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

    // Microsleep blackout overlay — sits above everything, tweened on stage 4 fatigue
    this.microsleepOverlay = this.scene.add.rectangle(
      0, 0, this.game!.scale.width, this.game!.scale.height, 0x000000
    ).setScrollFactor(0).setDepth(700_000).setOrigin(0, 0).setAlpha(0);

    // Placement preview graphics — drawn in world space above fog
    this.placementGraphics = this.scene.add.graphics().setDepth(600_500);

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

    // Reveal starting area
    this.markExplored(player.x, player.y, SIGHT_DAY);
    this.updateFog(player.x, player.y, SIGHT_DAY);

    this.worldUnsubscribe = useWorldStore.subscribe((state) => {
      if (state.world) {
        this.syncResources(state.world);
        this.syncStructures(state.world);
        // Campfire fuel changed → fog needs redraw (handled by updateFog each frame)
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
    this.drawResource(g, res.type, res.x, res.y);
    this.resourceObjects.set(res.id, g);
  }

  private createStructureObject(s: any) {
    if (!this.scene) return;
    const g = this.scene.add.graphics();
    g.setDepth(this.objectDepth(s.x, s.y));
    this.drawStructure(g, s.type, s.x, s.y);
    this.structureObjects.set(s.id, g);
  }

  private createJungleCanopyObjects(world: any) {
    if (!this.scene || !world?.tileMap) return;
    for (const g of this.jungleTreeObjects) g.destroy();
    this.jungleTreeObjects = [];
    this.jungleCanopyTiles.clear();
    this.jungleCanopyMeta.clear();
    this.vineTreeByResourceId.clear();

    const vineNodes = (world.resources ?? []).filter((r: any) => r.type === 'vine' && r.quantity > 0);
    for (const vine of vineNodes) {
      const tx = vine.x;
      const ty = vine.y;
      if (tx < 1 || ty < 1 || tx >= world.width - 1 || ty >= world.height - 1) continue;
      const tile = world.tileMap[ty]?.[tx];
      if (!tile || tile.type !== 'dense_jungle') continue;

      const key = `${tx},${ty}`;
      if (this.jungleCanopyMeta.has(key)) continue;

      const seed = (tx * 928371 + ty * 523543) % 100;
      this.jungleCanopyTiles.add(key);

      const g = this.scene.add.graphics();
      g.setDepth(this.objectDepth(tx, ty) + 1);
      this.drawJungleCanopyTree(g, tx, ty, seed, false);
      this.jungleTreeObjects.push(g);
      this.jungleCanopyMeta.set(key, { tx, ty, seed, stripped: false, g });
      this.vineTreeByResourceId.set(vine.id, key);
    }
    this.renderVisibleTiles();
  }

  private drawJungleCanopyTree(g: Phaser.GameObjects.Graphics, tx: number, ty: number, seed: number, stripped: boolean) {
    const baseX = tx * TS + TS / 2 + ((seed % 3) - 1) * 2;
    const baseY = ty * TS + TS - 3;
    const trunkH = 26 + (seed % 6);

    // Clearer ground patch under tree so it doesn't read as dense-jungle tile there
    g.fillStyle(0x315f2d, 0.65);
    g.fillEllipse(baseX, baseY + 1, 24, 12);
    g.fillStyle(0x4a7a3f, 0.25);
    g.fillEllipse(baseX - 2, baseY, 16, 7);

    // Shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(baseX, baseY + 3, 22, 7);

    // Main trunk
    g.fillStyle(0x5a3720, 0.95);
    g.fillRect(baseX - 3, baseY - trunkH, 6, trunkH);
    g.fillStyle(0x7a4b2b, 0.4);
    g.fillRect(baseX - 1, baseY - trunkH, 2, trunkH);

    // Big canopy layers (extends into upper neighboring tiles)
    g.fillStyle(0x154a19, 0.98);
    g.fillCircle(baseX, baseY - trunkH - 8, 15);
    g.fillStyle(0x1f6123, 0.9);
    g.fillCircle(baseX - 10, baseY - trunkH - 4, 11);
    g.fillCircle(baseX + 10, baseY - trunkH - 3, 10);
    g.fillStyle(0x2f8734, 0.7);
    g.fillCircle(baseX, baseY - trunkH + 3, 9);

    // Hanging vines from canopy only
    const drawVine = (sx: number, sy: number, bend: number, len: number, col: number, alpha: number) => {
      g.lineStyle(1, col, alpha);
      let px = sx;
      let py = sy;
      for (let k = 1; k <= len; k++) {
        const nx = sx + Math.sin((k + bend) * 0.55) * bend * 0.9;
        const ny = sy + k * 2;
        g.lineBetween(px, py, nx, ny);
        px = nx; py = ny;
      }
      g.fillStyle(0x45ba4e, alpha * 0.9);
      g.fillCircle(px, py, 1.2);
    };

    if (!stripped) {
      // Vines originate from lower canopy / upper trunk and hang down visibly
      const vineRootY = baseY - trunkH - 6;
      drawVine(baseX - 3, vineRootY, 1.5, 14, 0x2f8a36, 0.86);
      drawVine(baseX + 2, vineRootY + 1, 2.1, 12, 0x3aa342, 0.78);
      if (seed % 2 === 0) drawVine(baseX + 7, vineRootY + 2, 1.7, 10, 0x2f8a36, 0.7);
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
      if (res.quantity > 0 && !hasObj) {
        this.createResourceObject(res);            // regenerated
      } else if (res.quantity <= 0 && hasObj) {
        this.resourceObjects.get(res.id)!.destroy();
        this.resourceObjects.delete(res.id);
      }
    }
  }

  private syncStructures(world: any) {
    const ids = new Set(world.structures.map((s: any) => s.id));
    for (const [id, g] of this.structureObjects) {
      if (!ids.has(id)) { g.destroy(); this.structureObjects.delete(id); }
    }
    for (const s of world.structures) {
      if (!this.structureObjects.has(s.id)) this.createStructureObject(s);
    }
  }

  private drawResource(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number) {
    const cx = tx * TS + TS / 2;
    // base = ground anchor at bottom of tile
    const base = ty * TS + TS - 4;

    switch (type) {
      case 'wood': {
        // Shadow
        g.fillStyle(0x000000, 0.22);
        g.fillEllipse(cx, base + 3, 22, 7);
        // Trunk
        g.fillStyle(0x6b3a1f);
        g.fillRect(cx - 3, base - 14, 6, 14);
        g.fillStyle(0x4a2010, 0.5);
        g.fillRect(cx - 1, base - 14, 2, 14);
        // Canopy layers (extends ~1.5 tiles up)
        g.fillStyle(0x1a5c1a);
        g.fillCircle(cx, base - 26, 13);
        g.fillStyle(0x2d8a2d, 0.9);
        g.fillCircle(cx - 5, base - 32, 10);
        g.fillCircle(cx + 5, base - 32, 10);
        g.fillStyle(0x3aad50, 0.8);
        g.fillCircle(cx, base - 38, 9);
        g.fillStyle(0x4acc60, 0.4);
        g.fillCircle(cx - 2, base - 40, 5);
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
        // Shadow
        g.fillStyle(0x000000, 0.20);
        g.fillEllipse(cx, base + 3, 18, 6);
        // Thin trunk — leans slightly
        g.fillStyle(0x8b6914);
        g.fillRect(cx - 2, base - 30, 5, 30);
        g.fillStyle(0xa07820, 0.6);
        g.fillRect(cx - 1, base - 30, 2, 30);
        // Trunk segments
        g.fillStyle(0x6b5010, 0.4);
        for (let i = 0; i < 5; i++) {
          g.fillRect(cx - 2, base - 6 - i * 6, 5, 2);
        }
        // Fan fronds — palm crown
        g.fillStyle(0x2a8c18, 0.9);
        g.fillEllipse(cx,      base - 42, 28, 8);
        g.fillEllipse(cx - 10, base - 36, 22, 7);
        g.fillEllipse(cx + 10, base - 36, 22, 7);
        g.fillStyle(0x3aad28, 0.85);
        g.fillEllipse(cx,      base - 46, 20, 6);
        g.fillEllipse(cx - 13, base - 40, 18, 5);
        g.fillEllipse(cx + 13, base - 40, 18, 5);
        // Frond highlight
        g.fillStyle(0x4cc030, 0.5);
        g.fillEllipse(cx - 2, base - 48, 10, 4);
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
      case 'exotic_fruit': {
        g.fillStyle(0xf5a623);
        g.fillCircle(cx, base - 5, 7);
        g.fillStyle(0xffc84a, 0.8);
        g.fillCircle(cx - 2, base - 7, 5);
        g.fillStyle(0xff8c00, 0.5);
        g.fillCircle(cx + 2, base - 3, 4);
        g.lineStyle(1, 0x1a6a08, 0.9);
        g.lineBetween(cx, base - 12, cx - 2, base - 14);
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
        // Dark-barked tree with amber resin drips
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(cx, base + 2, 22, 5);
        // Trunk — dark reddish-brown
        g.fillStyle(0x4a2a10);
        g.fillRect(cx - 4, base - 18, 8, 18);
        // Resin drips — amber streaks on trunk
        g.fillStyle(0xd4820a, 0.9);
        g.fillRect(cx - 2, base - 14, 3, 6);
        g.fillStyle(0xf0a020, 0.7);
        g.fillRect(cx + 1, base - 10, 2, 4);
        // Canopy — darker green than normal tree
        g.fillStyle(0x1e5010);
        g.fillCircle(cx, base - 22, 9);
        g.fillStyle(0x285c18, 0.8);
        g.fillCircle(cx - 4, base - 18, 6);
        g.fillCircle(cx + 4, base - 20, 6);
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

  private drawStructure(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number) {
    const cx  = tx * TS + TS / 2;
    const base = ty * TS + TS - 2; // ground anchor

    if (type === 'palm_shelter') {
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

    this.updateCrabs(delta);
    this.updateTurtles(delta);
    this.updateSpears(delta);

    // Fatigue visual effects (stumble + microsleep) — before movement so freeze takes effect
    this.updateFatigueEffects(delta);

    // Smooth movement runs every frame
    this.updatePlayerMovement(delta);

    this.gameLoop.update(delta);
    const tick = this.gameLoop.isTickReady();

    // Process gather menu selection every frame
    this.gatherResource();

    if (tick) {
      this.onGameTick();
      this.interactStructure();
      this.updateFishing(delta);
      this.updateFarmPlots(delta);
    }

    // Mouse hover detection
    this.updateHover();

    // Per-frame renders
    this.renderPlayer();
    const elapsed = useGameStore.getState().elapsedTime;
    this.updateDayNight(elapsed);
    this.updateFire();

    // Tiles: redraw only when camera crosses a tile boundary
    if (this.scene && this.cachedWorld) {
      const cam = this.scene.cameras.main;
      const curTx = Math.floor(cam.worldView.x / TS);
      const curTy = Math.floor(cam.worldView.y / TS);
      if (curTx !== this.lastTileViewTx || curTy !== this.lastTileViewTy) {
        this.renderVisibleTiles();
      }
    }

    // Fog redraws every frame — row-segment approach keeps it to ~40 draw calls
    {
      const { x, y } = usePlayerStore.getState().player;
      const sight = this.getSightRadius(elapsed);
      if (tick) this.markExplored(x, y, sight);
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

    // ── Spear throw (range 6 tiles) ───────────────────────────────────
    if (hasSpear) {
      const dx = wx - playerCx;
      const dy = wy - playerCy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 420; // px/s
      const angle = Math.atan2(dy, dx);
      const g = this.scene!.add.graphics().setDepth(700_100);
      this.spears.push({
        id: Math.random().toString(36).slice(2),
        px: playerCx,
        py: playerCy,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed,
        angle,
        traveledPx: 0,
        maxRangePx: 6 * TS,
        g,
      });
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
        this.spawnFloatingText('🐢 Gefangen! Fleisch ×2 + Panzer ×1', Math.floor(turtle.px / TS), Math.floor(turtle.py / TS), '#86efac');
        turtle.g.destroy();
        this.turtles = this.turtles.filter(t => t.id !== turtle.id);
        return;
      }
    }
  }

  private updateSpears(delta: number) {
    if (!this.scene) return;
    const dt = delta / 1000;
    const { addToInventory } = usePlayerStore.getState();

    for (const spear of [...this.spears]) {
      spear.px += spear.vx * dt;
      spear.py += spear.vy * dt;
      const step = Math.sqrt(spear.vx ** 2 + spear.vy ** 2) * dt;
      spear.traveledPx += step;

      // Check turtle hit
      let hit = false;
      for (const turtle of [...this.turtles]) {
        const dist = Math.hypot(spear.px - turtle.px, spear.py - turtle.py);
        if (dist < TS * 0.8) {
          addToInventory('turtle_meat', 1);
          this.spawnFloatingText('🐢 Getroffen! Fleisch ×1', Math.floor(turtle.px / TS), Math.floor(turtle.py / TS), '#86efac');
          turtle.g.destroy();
          this.turtles = this.turtles.filter(t => t.id !== turtle.id);
          hit = true;
          break;
        }
      }

      // Check crab hit
      if (!hit) {
        for (const crab of [...this.crabs]) {
          const dist = Math.hypot(spear.px - crab.px, spear.py - crab.py);
          if (dist < TS * 0.6) {
            addToInventory('crab_meat', 1);
            this.spawnFloatingText('🦀 Getroffen! Fleisch ×1', Math.floor(crab.px / TS), Math.floor(crab.py / TS), '#fb923c');
            crab.g.destroy();
            this.crabs = this.crabs.filter(c => c.id !== crab.id);
            hit = true;
            break;
          }
        }
      }

      // Remove spear when hit or out of range
      if (hit || spear.traveledPx >= spear.maxRangePx) {
        spear.g.destroy();
        this.spears = this.spears.filter(s => s.id !== spear.id);
        continue;
      }

      // Draw spear as a line (shaft + tip)
      spear.g.clear();
      const cos = Math.cos(spear.angle);
      const sin = Math.sin(spear.angle);
      const L = 18; // shaft length px
      spear.g.lineStyle(2, 0xc8a46e); // wood shaft
      spear.g.beginPath();
      spear.g.moveTo(spear.px - cos * L, spear.py - sin * L);
      spear.g.lineTo(spear.px + cos * (L * 0.4), spear.py + sin * (L * 0.4));
      spear.g.strokePath();
      // Flint tip — small triangle
      spear.g.fillStyle(0x94a3b8);
      const tipX = spear.px + cos * L * 0.4;
      const tipY = spear.py + sin * L * 0.4;
      const perpX = -sin * 3;
      const perpY =  cos * 3;
      spear.g.fillTriangle(
        tipX + cos * 6, tipY + sin * 6,
        tipX + perpX,   tipY + perpY,
        tipX - perpX,   tipY - perpY,
      );
    }
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
      g.fillStyle(0xffffff, 0.18);
      if (recipeId === 'palm_shelter') {
        g.fillRect(px + 4, py + 4, w * TS - 8, TS - 8);
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

    // Check & consume materials
    if (!craftingSystem.canCraft(recipeId, inv)) return;
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    for (const input of recipe.inputs) removeResource(input.resourceId, input.quantity);

    // Place structure or construction site
    const CONSTRUCTION_DAYS: Record<string, number> = { wooden_shelter: 2, log_cabin: 4 };
    const days = CONSTRUCTION_DAYS[recipeId];
    if (days) {
      useWorldStore.getState().placeConstructionSite(recipeId, tx, ty, days);
    } else {
      useWorldStore.getState().placeStructure(recipeId, tx, ty);
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
      updateStats({ stamina: Math.max(0, player.stats.stamina - (isSprinting ? 1.0 : 0.5)) });
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
    const staminaRegen = regenBase * fatigueMult * hungerMult * thirstMult;
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
    // ── Poison drain
    const poisonedUntil = player.stats.poisonedUntil ?? 0;
    if (Date.now() < poisonedUntil) healthDrain += 0.025; // ~150 HP/day while poisoned
    const newHealth = Math.max(0, health - healthDrain);

    updateStats({ health: newHealth, hunger: newHunger, thirst: newThirst, stamina: newStamina, fatigue: newFatigue });

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

    // Drain campfire fuel once per game day
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

    const now = Date.now();
    if (now - this.lastSaveTime > this.autoSaveInterval) {
      this.lastSaveTime = now;
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
        case 'palm_tree':    return anyKnife ? { stamina: 3, time: T * 5 } : { stamina: 5, time: T * 10 };
        // Medium — cutting (needs knife, costs more without)
        case 'fiber':        return anyKnife ? { stamina: 5, time: T * 8  } : { stamina: 10, time: T * 20 };
        case 'vine':         return anyKnife ? { stamina: 5, time: T * 8  } : { stamina: 10, time: T * 20 };
        case 'fish':         return { stamina: 5, time: T * 15 };
        // Heavy — chopping / mining
        case 'wood':         return anyAxe   ? { stamina: 5,  time: T * 15 } : { stamina: 10, time: T * 40 };
        case 'stone':        return anyPick  ? { stamina: 6,  time: T * 20 } : { stamina: 12, time: T * 50 };
        case 'iron_ore':     return anyPick  ? { stamina: 8,  time: T * 30 } : { stamina: 15, time: T * 80 };
        case 'resin_tree':   return anyAxe   ? { stamina: 6,  time: T * 20 } : { stamina: 12, time: T * 50 };
        case 'coconut_shell': return { stamina: 2, time: T * 3 };
        default:             return { stamina: 3, time: T * 5 };
      }
    })();

    const currentStamina = usePlayerStore.getState().player.stats.stamina ?? 0;
    if (currentStamina < cost.stamina) return;

    // iron_ore still requires a pickaxe
    if (resource.type === 'iron_ore' && !anyPick) return;

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

    // Determine what item to give
    const giveType = action === 'sticks'              ? 'sticks'
                   : resource.type === 'spring'       ? 'water'
                   : resource.type === 'palm_tree'    ? 'palm_leaf'
                   : resource.type === 'resin_tree'   ? 'tree_resin'
                   : resource.type;

    // Always 1 per click
    const amount = Math.min(1, resource.quantity);
    if (addToInventory(giveType, amount)) {
      if (resource.type !== 'spring') worldState.harvestResource(resource.id, amount);

      // Bonus fiber from palm_tree with knife
      if (resource.type === 'palm_tree' && anyKnife) {
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
      const label = resource.type === 'palm_tree'
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
    }

    // E key: sleep
    if (this.keyPressed.e) {
      this.keyPressed.e = false;

      const onCabin   = structures.some(s =>
        ['wooden_shelter', 'log_cabin'].includes(s.type) &&
        s.x === player.x && s.y === player.y
      );
      const onShelter = structures.some(s => {
        if (s.type !== 'palm_shelter') return false;
        const w = s.width ?? 1;
        return s.y === player.y && player.x >= s.x && player.x < s.x + w;
      });

      const quality = onCabin ? 'cabin' : onShelter ? 'shelter' : 'outdoor';
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
}
