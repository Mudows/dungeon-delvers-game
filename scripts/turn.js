import { physicalAttack } from './combat.js';

// =============================================================================
// TurnManager — gerencia o ciclo de turnos do jogo
// =============================================================================

export class TurnManager {
  constructor() {
    /** @type {Enemy[]} Lista de inimigos ativos, em ordem de ação */
    this.enemies = [];
    this.turn = 1;

    this._onTurnStart = null;
    this._onTurnEnd = null;
  }

  addEnemy(enemy)    { this.enemies.push(enemy); }
  removeEnemy(enemy) { this.enemies = this.enemies.filter((e) => e !== enemy); }

  onTurnStart(fn) { this._onTurnStart = fn; }
  onTurnEnd(fn)   { this._onTurnEnd   = fn; }

  /**
   * Executa um turno completo:
   * 1. Tenta executar a ação do jogador.
   * 2. Se bem-sucedida, cada inimigo vivo executa sua ação em ordem.
   *
   * @param {Function}  playerAction - função que retorna true se a ação foi válida
   * @param {GameMap}   map
   * @param {Grid}      grid
   * @param {object}    player
   * @returns {boolean} se o turno avançou
   */
  playerAct(playerAction, map, grid, player) {
    const success = playerAction();
    if (!success) return false;

    this._onTurnStart?.(this.turn);

    // Itera sobre uma cópia para evitar problemas se um inimigo morrer
    // durante o loop e modificar this.enemies
    for (const enemy of [...this.enemies]) {
      if (!enemy.isDead()) {
        enemy.act(map, grid, player, this);
      }
    }

    this._onTurnEnd?.(this.turn);
    this.turn++;
    return true;
  }
}

// =============================================================================
// EnemyFactory — cria instâncias de inimigos a partir dos dados do JSON
// =============================================================================

export class EnemyFactory {
  constructor(family) {
    this.familyName  = family.name;
    this.members     = family.members;
    this._totalWeight = this.members.reduce((sum, m) => sum + m.spawnChance, 0);
  }

  /**
   * Cria um inimigo em (gridX, gridY) com tipo sorteado por peso.
   *
   * @param {number}  gridX
   * @param {number}  gridY
   * @param {Grid}    grid
   * @param {object}  runtime - runtime do Construct 3
   * @returns {Enemy}
   */
  spawn(gridX, gridY, grid, runtime) {
    const data     = this._weightedPick();
    const instance = this._createSprite(data.spriteName, gridX, gridY, grid, runtime);
    return new Enemy(gridX, gridY, grid, data, instance);
  }

  /** Sorteio ponderado entre os membros da família */
  _weightedPick() {
    let roll = Math.random() * this._totalWeight;
    for (const member of this.members) {
      roll -= member.spawnChance;
      if (roll <= 0) return member;
    }
    return this.members[this.members.length - 1];
  }

  /** Cria o sprite do inimigo no C3 na posição de pixel correta */
  _createSprite(spriteName, gridX, gridY, grid, runtime) {
    const objectType = runtime.objects[spriteName];
    if (!objectType) {
      console.warn(`[EnemyFactory] Objeto "${spriteName}" não encontrado no C3.`);
      return null;
    }
    const pixel = grid.toPixel(gridX, gridY);
    return objectType.createInstance('Game', pixel.x, pixel.y);
  }
}

// =============================================================================
// Enemy — entidade inimiga com IA de perseguição e combate
// =============================================================================

/** Constantes visuais da barra de HP (em pixels) */
const HP_BAR_OFFSET_Y = 4;
const HP_BAR_HEIGHT   = 2;
const HP_BAR_WIDTH    = 16; // deve coincidir com o tileSize

export class Enemy {
  constructor(gridX, gridY, grid, data, sprite) {
    const pixel  = grid.toPixel(gridX, gridY);
    this.x       = pixel.x;
    this.y       = pixel.y;
    this.id      = data.id;
    this.name    = data.name;
    this.sprite  = sprite;

    this.hp       = data.stats.hp;
    this.maxHp    = data.stats.hp;
    this.atq      = data.stats.atq;
    this.def      = data.stats.def;
    this.weaponAtq = 0;

    this._dead = false;

    this._initHpBar(grid);
  }

  // ---------------------------------------------------------------------------
  // IA — decisão de ação por turno
  // ---------------------------------------------------------------------------

  /**
   * Lógica de ação do inimigo por turno.
   *
   * Prioridade:
   *   1. Se o jogador estiver adjacente → ATACA (bump attack reverso)
   *   2. Caso contrário              → MOVE um tile em direção ao jogador via BFS
   *
   * O BFS garante que o inimigo navega corredores e desvie de paredes.
   * Outros inimigos também bloqueiam o caminho (sem sobreposição de tiles).
   *
   * @param {GameMap}      map
   * @param {Grid}         grid
   * @param {object}       player
   * @param {TurnManager}  turns  - usado para acessar a lista de outros inimigos
   */
  act(map, grid, player, turns) {
    // --- 1. ATAQUE: jogador adjacente → não precisa se mover ---
    if (this._isAdjacentTo(player, grid)) {
      const damage = physicalAttack(this, player);
      console.log(`${this.name} atacou o jogador: -${damage} HP`);
      return; // turno consumido com ataque
    }

    // --- 2. MOVIMENTO: busca o próximo passo via BFS ---
    const myPos     = grid.toGrid(this.x, this.y);
    const playerPos = grid.toGrid(player.x, player.y);

    // Monta o conjunto de tiles bloqueados por outros inimigos vivos
    // (exceto este — não se bloqueia)
    const blockedByEnemies = this._getEnemyOccupiedTiles(turns.enemies, grid);

    const nextStep = bfsNextStep(myPos, playerPos, map, blockedByEnemies);

    if (!nextStep) {
      // Sem caminho disponível (inimigo encurralado ou isolado) — fica parado
      return;
    }

    // Move o inimigo um tile
    this._moveTo(nextStep.x, nextStep.y, grid);
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
   * Cria os objetos de barra de HP no C3 se existirem no projeto.
   *
   * Objetos necessários no editor (layer "Game"):
   *   "HpBarBg"   — TiledBackground, fundo escuro (vermelho ou cinza)
   *   "HpBarFill" — TiledBackground, preenchimento (verde ou vermelho vivo)
   *
   * Se os objetos não existirem no projeto, o método falha silenciosamente
   * — o inimigo ainda funciona, apenas sem barra visual.
   */
  _initHpBar(grid) {
    this._hpBarBg   = null;
    this._hpBarFill = null;

    if (!this.sprite) return;

    const runtime  = this.sprite.runtime;
    const bgType   = runtime.objects['HpBarBg'];
    const fillType = runtime.objects['HpBarFill'];

    if (!bgType || !fillType) return; // objetos ausentes — silencioso

    const bx = this.x;
    const by = this.y - HP_BAR_OFFSET_Y;

    this._hpBarBg   = bgType.createInstance('Game', bx, by);
    this._hpBarFill = fillType.createInstance('Game', bx, by);

    this._hpBarBg.width    = HP_BAR_WIDTH;
    this._hpBarBg.height   = HP_BAR_HEIGHT;
    this._hpBarFill.width  = HP_BAR_WIDTH;
    this._hpBarFill.height = HP_BAR_HEIGHT;
  }

  /** Redimensiona o fill proporcional ao HP atual */
  _updateHpBar() {
    if (!this._hpBarFill) return;
    this._hpBarFill.width = Math.max(0, HP_BAR_WIDTH * (this.hp / this.maxHp));
  }

  _destroyHpBar() {
    this._hpBarBg?.destroy();
    this._hpBarFill?.destroy();
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /** Move o sprite e atualiza as coordenadas internas */
  _moveTo(gridX, gridY, grid) {
    const pixel = grid.toPixel(gridX, gridY);
    this.x = pixel.x;
    this.y = pixel.y;

    if (this.sprite) {
      this.sprite.x = pixel.x;
      this.sprite.y = pixel.y;
    }

    // Reposiciona a barra de HP junto com o sprite
    if (this._hpBarBg) {
      this._hpBarBg.x   = pixel.x;
      this._hpBarBg.y   = pixel.y - HP_BAR_OFFSET_Y;
    }
    if (this._hpBarFill) {
      this._hpBarFill.x = pixel.x;
      this._hpBarFill.y = pixel.y - HP_BAR_OFFSET_Y;
    }
  }

  /** Retorna true se `other` está a exatamente 1 tile de distância (4 direções) */
  _isAdjacentTo(other, grid) {
    const a  = grid.toGrid(this.x, this.y);
    const b  = grid.toGrid(other.x, other.y);
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }

  /**
   * Retorna um Set com as chaves "x,y" de todos os tiles ocupados por
   * inimigos vivos, excluindo este inimigo.
   *
   * Usado pelo BFS para que inimigos não se sobreponham ao se mover.
   *
   * @param {Enemy[]} enemies
   * @param {Grid}    grid
   * @returns {Set<string>}
   */
  _getEnemyOccupiedTiles(enemies, grid) {
    const occupied = new Set();
    for (const other of enemies) {
      if (other === this || other.isDead()) continue;
      const pos = grid.toGrid(other.x, other.y);
      occupied.add(`${pos.x},${pos.y}`);
    }
    return occupied;
  }
}

// =============================================================================
// BFS — Pathfinding no grid para IA dos inimigos
// =============================================================================

/**
 * Busca em largura (BFS) do tile `from` até `to`.
 *
 * Retorna o PRÓXIMO PASSO do caminho — ou seja, o tile adjacente a `from`
 * que leva ao destino pelo caminho mais curto. O inimigo move apenas 1 tile
 * por turno, então só precisamos do primeiro passo.
 *
 * Por que BFS e não A*?
 *   BFS é ótimo para grids sem custo variável de movimento (todos os tiles
 *   de chão têm custo 1). É mais simples, sem heurísticas, e perfeitamente
 *   adequado para o tamanho de mapa do MVP (32×32).
 *   Se o jogo crescer para mapas maiores ou terrenos com custos variados,
 *   substitua esta função por A* sem alterar o restante da IA.
 *
 * @param {{ x: number, y: number }} from        - posição do inimigo (grid)
 * @param {{ x: number, y: number }} to          - posição do jogador (grid)
 * @param {GameMap}                  map         - para checar paredes
 * @param {Set<string>}              blocked     - tiles bloqueados por outros inimigos
 * @returns {{ x: number, y: number } | null}    - próximo tile, ou null se sem caminho
 */
function bfsNextStep(from, to, map, blocked) {
  // Caso trivial: já chegou ao destino (não deve acontecer — ataque teria ocorrido)
  if (from.x === to.x && from.y === to.y) return null;

  // Direções de movimento: cima, baixo, esquerda, direita (sem diagonal)
  const DIRS = [
    { dx:  0, dy: -1 }, // cima
    { dx:  0, dy:  1 }, // baixo
    { dx: -1, dy:  0 }, // esquerda
    { dx:  1, dy:  0 }, // direita
  ];

  // visited: rastrea tiles já explorados para evitar loops
  const visited = new Set();
  visited.add(`${from.x},${from.y}`);

  // Fila do BFS: cada nó guarda a posição atual e o PRIMEIRO passo dado
  // (assim não precisamos reconstruir o caminho completo ao final)
  const queue = [];

  for (const { dx, dy } of DIRS) {
    const nx = from.x + dx;
    const ny = from.y + dy;
    const key = `${nx},${ny}`;

    if (visited.has(key)) continue;

    // Tile de destino (jogador): podemos chegar aqui mesmo que seja "bloqueado"
    // pois o combate acontece antes do movimento — nunca colidimos de verdade
    const isTarget = nx === to.x && ny === to.y;

    if (!isTarget && (map.isWall(nx, ny) || blocked.has(key))) continue;

    visited.add(key);

    // firstStep = o vizinho direto de `from` que iniciou este caminho
    queue.push({ x: nx, y: ny, firstStep: { x: nx, y: ny } });
  }

  // Processa a fila BFS
  while (queue.length > 0) {
    const current = queue.shift();

    // Chegou ao destino: retorna o primeiro passo do caminho encontrado
    if (current.x === to.x && current.y === to.y) {
      return current.firstStep;
    }

    for (const { dx, dy } of DIRS) {
      const nx  = current.x + dx;
      const ny  = current.y + dy;
      const key = `${nx},${ny}`;

      if (visited.has(key)) continue;

      const isTarget = nx === to.x && ny === to.y;

      if (!isTarget && (map.isWall(nx, ny) || blocked.has(key))) continue;

      visited.add(key);
      queue.push({ x: nx, y: ny, firstStep: current.firstStep });
    }
  }

  // Nenhum caminho encontrado
  return null;
}
