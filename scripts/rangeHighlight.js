/**
 * rangeHighlight.js — Gerencia highlight e cursor de seleção no combate.
 *
 * MODOS:
 *   move   — destaca tiles alcançáveis para movimento.
 *   attack — destaca apenas inimigos atacáveis.
 */

export const HighlightMode = Object.freeze({
  MOVE   : 'move',
  ATTACK : 'attack',
});

const TILE_SIZE = 16;
const SELECTED_SIZE = 22;

export class RangeHighlight {
  constructor(runtime, grid) {
    this.runtime = runtime;
    this.grid = grid;
    this._active = [];
    this._selectedIndex = -1;
  }

  show(mode, player, map, enemies, range) {
    this.clear();

    const origin = this.grid.toGrid(player.x, player.y);
    const tiles = mode === HighlightMode.MOVE
      ? this._calcMoveRange(origin, range, map, enemies)
      : this._calcAttackRange(origin, range, map, enemies);

    for (const tile of tiles) {
      const instance = this._spawnHighlight(tile, mode);

      if (instance) {
        this._active.push({
          ...tile,
          mode,
          instance,
          baseX: instance.x,
          baseY: instance.y,
        });
      }
    }

    if (this._active.length > 0) {
      this._selectedIndex = 0;
      this._updateSelectionVisual();
    }
  }

  get tiles() {
    return this._active.map(({ x, y }) => ({ x, y }));
  }

  get hasTiles() {
    return this._active.length > 0;
  }

  get selectedTile() {
    const selected = this._active[this._selectedIndex];
    return selected ? { x: selected.x, y: selected.y } : null;
  }

  clear() {
    for (const { instance } of this._active) {
      instance?.destroy();
    }

    this._active = [];
    this._selectedIndex = -1;
  }

  moveSelection(dx, dy) {
    if (this._active.length === 0) return null;
    if (this._selectedIndex < 0) this._selectedIndex = 0;

    const current = this._active[this._selectedIndex];
    let bestIndex = this._selectedIndex;
    let bestScore = Infinity;

    for (let i = 0; i < this._active.length; i++) {
      if (i === this._selectedIndex) continue;

      const candidate = this._active[i];
      const relX = candidate.x - current.x;
      const relY = candidate.y - current.y;
      const alignment = relX * dx + relY * dy;

      if (alignment <= 0) continue;

      const sideways = Math.abs(relX * dy - relY * dx);
      const distance = Math.abs(relX) + Math.abs(relY);
      const score = sideways * 10 + distance;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    this._selectedIndex = bestIndex;
    this._updateSelectionVisual();
    return this.selectedTile;
  }

  selectNext(delta) {
    if (this._active.length === 0) return null;

    this._selectedIndex = (this._selectedIndex + delta + this._active.length) % this._active.length;
    this._updateSelectionVisual();
    return this.selectedTile;
  }

  _updateSelectionVisual() {
    for (let i = 0; i < this._active.length; i++) {
      const entry = this._active[i];
      const inst = entry.instance;
      const selected = i === this._selectedIndex;

      if (!inst) continue;

      const size = selected ? SELECTED_SIZE : TILE_SIZE;
      const offset = (size - TILE_SIZE) / 2;

      inst.width = size;
      inst.height = size;
      inst.x = entry.baseX - offset;
      inst.y = entry.baseY - offset;
      inst.opacity = selected ? 0.95 : 0.45;

      if (selected) {
        inst.colorRgb = [1, 1, 0.15];
      } else if (entry.mode === HighlightMode.ATTACK) {
        inst.colorRgb = [1, 0.2, 0.2];
      } else {
        inst.colorRgb = [0.2, 1, 0.2];
      }
    }
  }

  _calcMoveRange(origin, range, map, enemies) {
    const occupied = this._buildOccupiedSet(enemies);
    const visited = new Map();
    const queue = [{ x: origin.x, y: origin.y, dist: 0 }];
    const result = [];
    const dirs = [[0,-1], [0,1], [-1,0], [1,0]];

    visited.set(_key(origin), 0);

    while (queue.length > 0) {
      const { x, y, dist } = queue.shift();

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const k = _key({ x: nx, y: ny });

        if (visited.has(k)) continue;
        if (map.isWall(nx, ny)) continue;
        if (occupied.has(k)) continue;

        const nextDist = dist + 1;
        visited.set(k, nextDist);

        if (nextDist <= range) {
          result.push({ x: nx, y: ny });
          queue.push({ x: nx, y: ny, dist: nextDist });
        }
      }
    }

    return result;
  }

  _calcAttackRange(origin, range, map, enemies) {
    const enemyPositions = new Map();

    for (const e of enemies) {
      if (e.isDead()) continue;

      const pos = this.grid.toGrid(e.x, e.y);
      enemyPositions.set(_key(pos), e);
    }

    const visited = new Set([_key(origin)]);
    const queue = [{ x: origin.x, y: origin.y, dist: 0 }];
    const result = [];
    const dirs = [[0,-1], [0,1], [-1,0], [1,0]];

    while (queue.length > 0) {
      const { x, y, dist } = queue.shift();

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const k = _key({ x: nx, y: ny });

        if (visited.has(k)) continue;
        if (map.isWall(nx, ny)) continue;

        visited.add(k);

        const nextDist = dist + 1;
        if (nextDist > range) continue;

        if (enemyPositions.has(k)) {
          result.push({ x: nx, y: ny });
        } else {
          queue.push({ x: nx, y: ny, dist: nextDist });
        }
      }
    }

    return result;
  }

  _spawnHighlight({ x, y }, mode) {
    const type = this.runtime.objects['TileHighlight'];

    if (!type) {
      console.warn('[RangeHighlight] Objeto "TileHighlight" não encontrado no C3.');
      return null;
    }

    const pixel = this.grid.toPixel(x, y);
    const instance = type.createInstance('Game', pixel.x, pixel.y);

    instance.width = TILE_SIZE;
    instance.height = TILE_SIZE;
    instance.opacity = 0.45;
    instance.colorRgb = mode === HighlightMode.ATTACK ? [1, 0.2, 0.2] : [0.2, 1, 0.2];

    return instance;
  }

  _buildOccupiedSet(enemies) {
    const set = new Set();

    for (const e of enemies) {
      if (e.isDead()) continue;
      set.add(_key(this.grid.toGrid(e.x, e.y)));
    }

    return set;
  }
}

function _key({ x, y }) {
  return `${x},${y}`;
}