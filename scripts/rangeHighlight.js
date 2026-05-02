/**
 * rangeHighlight.js — Gerencia o highlight de alcance no combate.
 *
 * Cria e destrói instâncias do objeto TileHighlight do C3 para indicar
 * ao jogador quais tiles ele pode alcançar dependendo da ação escolhida.
 *
 * MODOS:
 *   'move'   — BFS até mov_base tiles. Cor: verde (padrão do sprite).
 *              Respeita paredes e tiles ocupados por inimigos.
 *   'attack' — BFS até range tiles. Marca apenas tiles com inimigo.
 *              range vem do item equipado (weapon.range ?? 1).
 *
 * PRÉ-REQUISITO NO C3:
 *   Objeto "TileHighlight" deve existir no projeto — sprite 16×16,
 *   semitransparente. Para modo 'attack', o código tinge o sprite de
 *   vermelho via colorRgb. Para 'move', usa a cor padrão (verde).
 *
 * USO:
 *   import { RangeHighlight } from './rangeHighlight.js';
 *
 *   const highlight = new RangeHighlight(runtime, grid);
 *
 *   // Exibe alcance de movimento
 *   highlight.show('move', player, map, enemies);
 *
 *   // Exibe alcance de ataque (arma com range 3)
 *   highlight.show('attack', player, map, enemies, 3);
 *
 *   // Retorna os tiles atualmente destacados
 *   const tiles = highlight.tiles; // [{ x, y }, ...]
 *
 *   // Remove todos os highlights
 *   highlight.clear();
 */

export const HighlightMode = Object.freeze({
  MOVE   : 'move',
  ATTACK : 'attack',
});

export class RangeHighlight {
  /**
   * @param {IRuntime} runtime
   * @param {Grid}     grid
   */
  constructor(runtime, grid) {
    this.runtime = runtime;
    this.grid    = grid;

    /** @type {{ x: number, y: number, instance: IWorldInstance }[]} */
    this._active = [];
  }

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------

  /**
   * Calcula e exibe os tiles alcançáveis para o modo dado.
   *
   * @param {'move'|'attack'} mode
   * @param {IWorldInstance}  player   - sprite do jogador
   * @param {GameMap}         map
   * @param {Enemy[]}         enemies  - lista de inimigos ativos
   * @param {number}          range    - alcance em tiles (move: mov_base, attack: weapon.range ?? 1)
   */
  show(mode, player, map, enemies, range) {
    this.clear();

    const origin = this.grid.toGrid(player.x, player.y);

    const tiles = mode === HighlightMode.MOVE
      ? this._calcMoveRange(origin, range, map, enemies)
      : this._calcAttackRange(origin, range, map, enemies);

    for (const tile of tiles) {
      const instance = this._spawnHighlight(tile, mode);
      if (instance) this._active.push({ ...tile, instance });
    }
  }

  /**
   * Tiles atualmente destacados (sem referência à instância C3).
   * @returns {{ x: number, y: number }[]}
   */
  get tiles() {
    return this._active.map(({ x, y }) => ({ x, y }));
  }

  /** Remove todos os highlights da tela. */
  clear() {
    for (const { instance } of this._active) {
      instance?.destroy();
    }
    this._active = [];
  }

  // ---------------------------------------------------------------------------
  // Cálculo de alcance
  // ---------------------------------------------------------------------------

  /**
   * BFS a partir de origin até range tiles.
   * Respeita paredes e tiles ocupados por inimigos vivos.
   * Não inclui o tile de origem nem tiles com inimigo.
   *
   * @param {{ x, y }} origin
   * @param {number}   range
   * @param {GameMap}  map
   * @param {Enemy[]}  enemies
   * @returns {{ x: number, y: number }[]}
   */
  _calcMoveRange(origin, range, map, enemies) {
    const occupied = this._buildOccupiedSet(enemies);
    const visited  = new Map(); // key → distância
    const queue    = [{ x: origin.x, y: origin.y, dist: 0 }];
    const result   = [];
    const dirs     = [[0,-1],[0,1],[-1,0],[1,0]];

    visited.set(_key(origin), 0);

    while (queue.length > 0) {
      const { x, y, dist } = queue.shift();

      for (const [dx, dy] of dirs) {
        const nx   = x + dx;
        const ny   = y + dy;
        const k    = _key({ x: nx, y: ny });
        const next = { x: nx, y: ny };

        if (visited.has(k))         continue;
        if (map.isWall(nx, ny))     continue;
        if (occupied.has(k))        continue;

        const nextDist = dist + 1;
        visited.set(k, nextDist);

        if (nextDist <= range) {
          result.push(next);
          queue.push({ x: nx, y: ny, dist: nextDist });
        }
      }
    }

    return result;
  }

  /**
   * BFS a partir de origin até range tiles.
   * Retorna apenas tiles que contêm um inimigo vivo — são os alvos atacáveis.
   * Passa por tiles de chão livres mas não os destaca.
   *
   * @param {{ x, y }} origin
   * @param {number}   range
   * @param {GameMap}  map
   * @param {Enemy[]}  enemies
   * @returns {{ x: number, y: number }[]}
   */
  _calcAttackRange(origin, range, map, enemies) {
    const enemyPositions = new Map(); // key → Enemy
    for (const e of enemies) {
      if (e.isDead()) continue;
      const pos = this.grid.toGrid(e.x, e.y);
      enemyPositions.set(_key(pos), e);
    }

    const visited = new Set([_key(origin)]);
    const queue   = [{ x: origin.x, y: origin.y, dist: 0 }];
    const result  = [];
    const dirs    = [[0,-1],[0,1],[-1,0],[1,0]];

    while (queue.length > 0) {
      const { x, y, dist } = queue.shift();

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const k  = _key({ x: nx, y: ny });

        if (visited.has(k))     continue;
        if (map.isWall(nx, ny)) continue;
        visited.add(k);

        const nextDist = dist + 1;
        if (nextDist > range)   continue;

        if (enemyPositions.has(k)) {
          result.push({ x: nx, y: ny });
        } else {
          // Tile vazio — continua BFS mas não destaca
          queue.push({ x: nx, y: ny, dist: nextDist });
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Cria uma instância de TileHighlight no tile dado.
   * Tinge de vermelho para ataques, mantém verde para movimento.
   */
  _spawnHighlight({ x, y }, mode) {
    const type = this.runtime.objects['TileHighlight'];
    if (!type) {
      console.warn('[RangeHighlight] Objeto "TileHighlight" não encontrado no C3.');
      return null;
    }

    const pixel    = this.grid.toPixel(x, y);
    const instance = type.createInstance('Game', pixel.x, pixel.y);

    if (mode === HighlightMode.ATTACK) {
      instance.colorRgb = [1, 0.2, 0.2]; // vermelho
    }

    return instance;
  }

  /** Constrói um Set com as chaves de grid de todos os inimigos vivos. */
  _buildOccupiedSet(enemies) {
    const set = new Set();
    for (const e of enemies) {
      if (e.isDead()) continue;
      set.add(_key(this.grid.toGrid(e.x, e.y)));
    }
    return set;
  }
}

// ---------------------------------------------------------------------------
// Helpers de módulo
// ---------------------------------------------------------------------------

function _key({ x, y }) { return `${x},${y}`; }