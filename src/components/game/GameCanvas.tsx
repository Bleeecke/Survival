import { useEffect, useRef } from 'react';
import { GameManager } from '../../services/phaser/GameManager';
import GatherMenu from './GatherMenu';
import ResourceTooltip from './ResourceTooltip';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    // Defer by one frame so StrictMode double-invoke completes before we create Phaser.
    // Also ensures the container div has its final layout dimensions.
    const raf = requestAnimationFrame(() => {
      if (destroyed || !containerRef.current) return;
      gameManagerRef.current = new GameManager(containerRef.current);
    });
    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      gameManagerRef.current?.destroy();
      gameManagerRef.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-slate-900">
      <div ref={containerRef} className="absolute inset-0" />
      <GatherMenu />
      <ResourceTooltip />
    </div>
  );
}
