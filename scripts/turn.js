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

/** Altura em pixels da barra de HP acima do sprite */
const HP_BAR_OFFSET_Y = 4;
const HP_BAR_HEIGHT   = 2;
const HP_BAR_WIDTH    = 16; // igual ao tileSize

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

    // Barra de HP: criada como DrawingCanvas ou objeto dedicado no C3.
    // Por enquanto usamos instVars no sprite se disponível,
    // e desenhamos via sprite de barra se existir.
    this._initHpBar(grid);
  }

  // ---------------------------------------------------------------------------
  // IA (stub — será expandido)
  // ---------------------------------------------------------------------------

  /**
   * Ação do inimigo por turno.
   * Se o jogador estiver adjacente, ataca. Caso contrário, fica parado.
   *
   * @param {GameMap}      map
   * @param {Grid}         grid
   * @param {object}       player
   * @param {TurnManager}  turns
   */
  act(map, grid, player, turns) {
    if (this._isAdjacentTo(player, grid)) {
      const damage = physicalAttack(this, player);
      console.log(`${this.name} atacou o jogador: -${damage} HP`);
    }
    // Movimento: a implementar na etapa de IA
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

  /**
   * Inicializa a barra de HP.
   * Estratégia: usa dois objetos TiledBackground (ou Sprite) sobrepostos
   * nomeados "HpBarBg" (fundo vermelho) e "HpBarFill" (preenchimento verde)
   * no projeto C3. Se não existirem, a barra é ignorada silenciosamente.
   *
   * Alternativa simples sem objetos extras: usar instVars do próprio sprite
   * e desenhar via evento no C3 — mas isso fica fora do JS.
   */
  _initHpBar(grid) {
    this._hpBarBg   = null;
    this._hpBarFill = null;

    if (!this.sprite) return;

    const runtime = this.sprite.runtime;

    // Tenta criar os objetos de barra se existirem no projeto
    const bgType   = runtime.objects['HpBarBg'];
    const fillType = runtime.objects['HpBarFill'];

    if (!bgType || !fillType) {
      // Projeto ainda sem objetos de barra — silencioso
      return;
    }

    const bx = this.x;
    const by = this.y - HP_BAR_OFFSET_Y;

    this._hpBarBg   = bgType.createInstance('UI', bx, by);
    this._hpBarFill = fillType.createInstance('UI', bx, by);

    this._hpBarBg.width   = HP_BAR_WIDTH;
    this._hpBarBg.height  = HP_BAR_HEIGHT;
    this._hpBarFill.width = HP_BAR_WIDTH;
    this._hpBarFill.height = HP_BAR_HEIGHT;
  }

  /** Atualiza a largura do fill proporcional ao HP atual */
  _updateHpBar() {
    if (!this._hpBarFill) return;
    this._hpBarFill.width = Math.max(0, HP_BAR_WIDTH * (this.hp / this.maxHp));
  }

  _destroyHpBar() {
    this._hpBarBg?.destroy();
    this._hpBarFill?.destroy();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _isAdjacentTo(other, grid) {
    const a = grid.toGrid(this.x,  this.y);
    const b = grid.toGrid(other.x, other.y);
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    // Adjacente = 1 tile de distância em 4 direções (sem diagonal)
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }
}