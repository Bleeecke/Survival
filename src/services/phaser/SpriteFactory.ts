import type Phaser from 'phaser';
import { drawResourceArt, RESOURCE_ART_TYPES } from './ResourceArt';

/** Shared variants with bounded harvest states, independent of the number of world objects. */
export class SpriteFactory {
  static layout(type: string) {
    return type === 'large_tree' || type === 'banyan_tree'
      ? { width: 384, height: 448, base: 400 }
      : { width: 160, height: 192, base: 156 };
  }
  static texture(scene: Phaser.Scene, type: string, variant: number, quantity: number): string | null {
    if (!RESOURCE_ART_TYPES.has(type)) return null;
    const state = ['palm_tree', 'berry_bush', 'exotic_fruit', 'breadfruit_tree', 'cacao_tree'].includes(type) ? (quantity >= 3 ? 3 : quantity >= 1 ? 1 : 0) : 1;
    const key = `island-art:${type}:${variant}:${state}`;
    if (!scene.textures.exists(key)) {
      const graphics = scene.add.graphics();
      const layout = this.layout(type);
      drawResourceArt(graphics, type, layout.width / 2, layout.base, variant, state);
      graphics.generateTexture(key, layout.width, layout.height);
      graphics.destroy();
    }
    return key;
  }
}
