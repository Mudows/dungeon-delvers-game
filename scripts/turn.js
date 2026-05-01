import { physicalAttack } from './combat.js';

/**
 * TurnManager — gerencia o ciclo de turnos do jogo.
 */
export class TurnManager {
  constructor() {
    /** @type {Enemy[]} */
    this.enemies = [];
    this.turn    = 1;

    this._onTurnStart = null;
    this._onTurnEnd   = null;
  }

  addEnemy(enemy)    { this.enemies.push(enemy); }
  removeEnemy(enemy) { this.enemies = this.enemies.filter((e) => e !== enemy); }

  onTurnStart(fn) { this._onTurnStart = fn; }
  onTurnEnd(fn)   { this._onTurnEnd   = fn; }

  playerAct(playerAction, map, grid, player) {
    const success = playerAction();
    if (!success) return false;

    this._onTurnStart?.(this.turn);

    for (const enemy of this.enemies) {
      if (!enemy.isDead()) {
        enemy.act(map, grid, player, this);
      }
    }

    // Remove inimigos que morreram durante o turno dos inimigos (ex: DOT futuro)
    this.enemies = this.enemies.filter(e => !e.isDead());

    this._onTurnEnd?.(this.turn);
    this.turn++;
    return true;
  }
}

// ---------------------------------------------------------------------------
// EnemyFactory
// ---------------------------------------------------------------------------

export class EnemyFactory {
  constructor(family) {
    this.familyName   = family.name;
    this.members      = family.members;
    this._totalWeight = this.members.reduce((sum, m) => sum + m.spawnChance, 0);
  }

  spawn(gridX, gridY, grid, runtime) {
    const data     = this._weightedPick();
    const instance = this._createSprite(data.spriteName, gridX, gridY, grid, runtime);
    return new Enemy(gridX, gridY, grid, data, instance);
  }

  _weightedPick() {
    let roll = Math.random() * this._totalWeight;
    for (const member of this.members) {
      roll -= member.spawnChance;
      if (roll <= 0) return member;
    }
    return this.members[this.members.length - 1];
  }

  _createSprite(spriteName, gridX, gridY, grid, runtime) {
    const objectType = runtime.objects[spriteName];
    if (!objectType) {
      console.warn(`[EnemyFactory] Objeto "${spriteName}" não encontrado no C3.`);
      return null;
    }
    const pixel    = grid.toPixel(gridX, gridY);
    const instance = objectType.createInstance('Game', pixel.x, pixel.y);
    return instance;
  }
}

// ---------------------------------------------------------------------------
// Enemy
// ---------------------------------------------------------------------------

const HP_BAR_OFFSET_Y = 4;
const HP_BAR_HEIGHT   = 2;
const HP_BAR_WIDTH    = 16;

export class Enemy {
  constructor(gridX, gridY, grid, data, sprite) {
    const pixel    = grid.toPixel(gridX, gridY);
    this.x         = pixel.x;
    this.y         = pixel.y;
    this.id        = data.id;
    this.name      = data.name;
    this.sprite    = sprite;

    this.hp        = data.stats.hp;
    this.maxHp     = data.stats.hp;
    this.atq       = data.stats.atq;
    this.def       = data.stats.def;
    this.weaponAtq = 0;

    this._dead     = false;

    this._initHpBar(grid);
  }

  // ---------------------------------------------------------------------------
  // IA
  // ---------------------------------------------------------------------------

  /**
   * Ação do inimigo por turno:
   *   1. Se o jogador estiver adjacente → ataca
   *   2. Se o jogador estiver no raio de visão E com linha de visão → persegue (BFS)
   *   3. Caso contrário → fica parado
   */
  act(map, grid, player, turns) {
    if (this._isAdjacentTo(player, grid)) {
      const damage = physicalAttack(this, player);
      console.log(`${this.name} atacou o jogador: -${damage} HP`);
      return;
    }

    if (this._canSeePlayer(player, grid, map)) {
      this._stepTowards(player, map, grid, turns.enemies);
    }
  }

  /**
   * Verifica se o jogador está dentro do raio de visão (Chebyshev, 5×5)
   * E se há linha de visão direta sem paredes pelo meio (Bresenham).
   */
  _canSeePlayer(player, grid, map) {
    const a = grid.toGrid(this.x,  this.y);
    const b = grid.toGrid(player.x, player.y);
    const VISION_RADIUS = 2;

    if (Math.abs(a.x - b.x) > VISION_RADIUS || Math.abs(a.y - b.y) > VISION_RADIUS) {
      return false;
    }

    return this._hasLineOfSight(a, b, map);
  }

  /**
   * Verifica linha de visão entre dois pontos do grid usando o algoritmo de Bresenham.
   * Retorna false se qualquer tile intermediário for parede.
   */
  _hasLineOfSight(from, to, map) {
    let x = from.x, y = from.y;
    const tx = to.x, ty = to.y;
    if (x === tx && y === ty) return true;

    const dx = Math.abs(tx - x);
    const dy = Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx - dy;

    while (x !== tx || y !== ty) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 <  dx) { err += dx; y += sy; }
      if (x === tx && y === ty) return true;
      if (map.isWall(x, y)) return false;
    }

    return true;
  }

  /**
   * Move o inimigo 1 tile em direção ao jogador usando BFS.
   * Não entra em tile ocupado por outro inimigo vivo.
   */
  _stepTowards(player, map, grid, enemies = []) {
    const start  = grid.toGrid(this.x,  this.y);
    const target = grid.toGrid(player.x, player.y);

    // Constrói set de tiles bloqueados por outros inimigos vivos
    const blocked = new Set();
    for (const e of enemies) {
      if (e === this || e.isDead()) continue;
      const pos = grid.toGrid(e.x, e.y);
      blocked.add(`${pos.x},${pos.y}`);
    }

    const next = this._bfsNextStep(start, target, map, blocked);
    if (!next) return;

    const pixel = grid.toPixel(next.x, next.y);
    this.x = pixel.x;
    this.y = pixel.y;

    if (this.sprite) {
      this.sprite.x = pixel.x;
      this.sprite.y = pixel.y;
    }
    this._syncHpBar(pixel.x, pixel.y);
  }

  /**
   * BFS do ponto start até target.
   * Retorna o primeiro passo do caminho ou null se não houver caminho.
   * Respeita paredes e tiles bloqueados por outros inimigos.
   */
  _bfsNextStep(start, target, map, blocked = new Set()) {
    const key     = ({ x, y }) => `${x},${y}`;
    const queue   = [{ pos: start, path: [] }];
    const visited = new Set([key(start)]);
    const dirs    = [[0,-1],[0,1],[-1,0],[1,0]];

    while (queue.length > 0) {
      const { pos, path } = queue.shift();

      for (const [dx, dy] of dirs) {
        const next = { x: pos.x + dx, y: pos.y + dy };
        const k    = key(next);

        if (visited.has(k)) continue;
        visited.add(k);

        if (next.x === target.x && next.y === target.y) {
          return path.length > 0 ? path[0] : next;
        }

        if (!map.isWall(next.x, next.y) && !blocked.has(k)) {
          queue.push({ pos: next, path: path.length === 0 ? [next] : path });
        }
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Dano e morte
  // ---------------------------------------------------------------------------

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this._updateHpBar();

    if (this.hp === 0) {
      this._dead = true;
      this._destroyHpBar();
      this.sprite?.destroy();
    }
  }

  isDead() { return this._dead; }

  // ---------------------------------------------------------------------------
  // Barra de HP
  // ---------------------------------------------------------------------------

  _initHpBar(grid) {
    this._hpBarBg   = null;
    this._hpBarFill = null;

    if (!this.sprite) return;

    const runtime = this.sprite.runtime;
    const bgType   = runtime.objects['HpBarBg'];
    const fillType = runtime.objects['HpBarFill'];

    if (!bgType || !fillType) return;

    const bx = this.x;
    const by = this.y - HP_BAR_OFFSET_Y;

    this._hpBarBg   = bgType.createInstance('Game', bx, by);
    this._hpBarFill = fillType.createInstance('Game', bx, by);

    this._hpBarBg.width    = HP_BAR_WIDTH;
    this._hpBarBg.height   = HP_BAR_HEIGHT;
    this._hpBarFill.width  = HP_BAR_WIDTH;
    this._hpBarFill.height = HP_BAR_HEIGHT;
  }

  _updateHpBar() {
    if (!this._hpBarFill) return;
    this._hpBarFill.width = Math.max(0, HP_BAR_WIDTH * (this.hp / this.maxHp));
  }

  _destroyHpBar() {
    this._hpBarBg?.destroy();
    this._hpBarFill?.destroy();
  }

  _syncHpBar(px, py) {
    if (this._hpBarBg) {
      this._hpBarBg.x   = px;
      this._hpBarBg.y   = py - HP_BAR_OFFSET_Y;
    }
    if (this._hpBarFill) {
      this._hpBarFill.x = px;
      this._hpBarFill.y = py - HP_BAR_OFFSET_Y;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _isAdjacentTo(other, grid) {
    const a = grid.toGrid(this.x,  this.y);
    const b = grid.toGrid(other.x, other.y);
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }
}
