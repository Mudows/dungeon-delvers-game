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
   * - Se o tile de destino tiver inimigo → chama onBumpAttack e retorna true
   * - Se for parede → retorna false (turno não avança)
   * - Se for chão livre → move normalmente
   *
   * @param {object}        actor         - entidade que age (jogador)
   * @param {number}        dx
   * @param {number}        dy
   * @param {GameMap}       map
   * @param {Enemy[]}       enemies       - lista de inimigos ativos
   * @param {Function|null} onBumpAttack  - callback(actor, target) para bump attack
   * @returns {boolean} true se a ação foi válida (move ou ataque)
   */
  move(actor, dx, dy, map, enemies = [], onBumpAttack = null) {
    const pos  = this.toGrid(actor.x, actor.y);
    const newX = pos.x + dx;
    const newY = pos.y + dy;

    const target = this._enemyAt(newX, newY, enemies);

    if (target) {
      onBumpAttack?.(actor, target);
      return true;
    }

    if (map.isWall(newX, newY)) return false;

    const pixel = this.toPixel(newX, newY);
    actor.x = pixel.x;
    actor.y = pixel.y;

    return true;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _enemyAt(x, y, enemies) {
    for (const enemy of enemies) {
      if (enemy.isDead()) continue;
      const pos = this.toGrid(enemy.x, enemy.y);
      if (pos.x === x && pos.y === y) return enemy;
    }
    return null;
  }
}
