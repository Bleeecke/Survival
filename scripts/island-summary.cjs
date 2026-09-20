function reachableTiles(world, maxDistance = Infinity) {
  const { width: w, height: h, tileMap: tiles } = world;
  const distance = new Int32Array(w * h).fill(-1);
  const start = world.spawnY * w + world.spawnX, queue = [start]; distance[start] = 0;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], x = current % w, y = Math.floor(current / w), from = tiles[y][x];
    if (distance[current] >= maxDistance) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || distance[ny * w + nx] >= 0) continue;
      const to = tiles[ny][nx], diff = to.elevation - from.elevation;
      if (!to.walkable || !(diff === 0 || diff === -1 || (diff === 1 && (from.isRamp || to.isRamp)))) continue;
      distance[ny * w + nx] = distance[current] + 1; queue.push(ny * w + nx);
    }
  }
  return distance;
}

function summarizeIsland(world) {
  const reachable = reachableTiles(world);
  const levels = [0, 0, 0, 0, 0], biomes = {};
  let walkable = 0, reached = 0, cliffs = 0, coast = 0, ramps = 0, jumps = 0;
  for (const row of world.tileMap) for (const t of row) {
    levels[t.elevation]++; biomes[t.type] = (biomes[t.type] ?? 0) + 1;
    if (t.isRamp) ramps++;
    if (t.walkable) { walkable++; if (reachable[t.y * world.width + t.x] >= 0) reached++; }
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const next = world.tileMap[t.y + dy]?.[t.x + dx];
      if (!next) continue;
      if ((t.type === 'water') !== (next.type === 'water')) coast++;
      else if (t.elevation !== next.elevation) cliffs++;
      if (Math.abs(t.elevation - next.elevation) > 1) jumps++;
    }
  }
  return { seed: world.seed, landPercent: +(100 * (1 - levels[0] / (world.width * world.height))).toFixed(2),
    levels, biomes, coastlineEdges: coast, cliffEdges: cliffs, ramps, heightJumps: jumps,
    reachablePercent: +(100 * reached / walkable).toFixed(3), unreachable: walkable - reached, resources: world.resources.length };
}
module.exports = { reachableTiles, summarizeIsland };
