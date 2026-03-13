import { physicalAttack } from './combat.js';

export class Grid {
  constructor(tileSize = 16) {
    this.tileSize = tileSize;
  }

  // ---------------------------------------------------------------------------
  // Conversões
  // ---------------------------------------------------------------------------

  toPixel(gridX, gridY) {
    return {
      x: gridX * this.tileSize,
      y: gridY * this.tileSize,
    };
  }

  toGrid(pixelX, pixelY) {
    return {
      x: Math.floor(pixelX / this.tileSize),
      y: Math.floor(pixelY / this.tileSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Movimento e bump attack
  // ---------------------------------------------------------------------------

  /**
   * Tenta mover `actor` em (dx, dy).
   *
   * - Se o tile de destino tiver inimigo → ataca (bump attack)
   * - Se for parede → retorna false (turno não avança)
   * - Se for chão livre → move normalmente
   *
   * @param {object}   actor    - entidade que age (jogador)
   * @param {number}   dx
   * @param {number}   dy
   * @param {GameMap}  map
   * @param {Enemy[]}  enemies  - lista de inimigos ativos
   * @param {TurnManager} turns - para remover inimigos mortos
   * @returns {boolean} true se a ação foi válida (move ou ataque)
   */
  move(actor, dx, dy, map, enemies = [], turns = null) {
    const pos  = this.toGrid(actor.x, actor.y);
    const newX = pos.x + dx;
    const newY = pos.y + dy;

    // Verifica se há inimigo no tile de destino
    const target = this._enemyAt(newX, newY, enemies);

    if (target) {
      // Bump attack — ataca ao invés de mover
      const damage = physicalAttack(actor, target);
      console.log(`Jogador atacou ${target.name}: -${damage} HP (${target.hp}/${target.maxHp})`);

      if (target.isDead()) {
        console.log(`${target.name} foi derrotado!`);
        turns?.removeEnemy(target);
      }

      return true; // ataque é uma ação válida — turno avança
    }

    // Verifica parede
    if (map.isWall(newX, newY)) return false;

    // Move normalmente
    const pixel = this.toPixel(newX, newY);
    actor.x = pixel.x;
    actor.y = pixel.y;

    return true;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Retorna o inimigo vivo que ocupa o tile (x, y), ou null.
   *
   * @param {number}   x
   * @param {number}   y
   * @param {Enemy[]}  enemies
   * @returns {Enemy|null}
   */
  _enemyAt(x, y, enemies) {
    for (const enemy of enemies) {
      if (enemy.isDead()) continue;

      const pos = this.toGrid(enemy.x, enemy.y);
      if (pos.x === x && pos.y === y) return enemy;
    }
    return null;
  }
}