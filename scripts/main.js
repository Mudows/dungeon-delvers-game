import { physicalAttack }                      from './combat.js';
import { randomInt }                           from './utils.js';
import { Grid }                                from './grid.js';
import { GameMap }                             from './map.js';
import { TurnManager, EnemyFactory }           from './turn.js';
import { HUD }                                 from './hud.js';
import { gameState, GameStates }               from './gameState.js';
import { CombatUI, CombatActions }             from './combatUI.js';
import { RangeHighlight, HighlightMode }       from './rangeHighlight.js';
import { TurnQueue }                           from './turnQueue.js';
import { initDebug }                           from './debug.js'; // remover em produção

// ---------------------------------------------------------------------------
// Configuração dos andares
// ---------------------------------------------------------------------------

const FLOOR_THEMES       = ['cave', 'cave', 'cave'];
const FLOOR_ROOMS        = [6, 8, 10];
const FLOOR_ENEMY_FAMILY = ['goblins', 'goblins', 'goblins'];

let currentFloor = 0;

async function OnBeforeProjectStart(runtime) {
  runtime.addEventListener('tick', () => Tick(runtime));
}

function Tick(runtime) {}

runOnStartup(async (runtime) => {
  const grid = new Grid(16);

  // ---------------------------------------------------------------------------
  // Referências globais
  // ---------------------------------------------------------------------------
  let map;
  let turns;       // TurnManager — mantém lista de inimigos e IA
  let player;
  let tileset;
  let stairSprite;
  let playerLight;
  let darkness;
  let hud;
  let enemiesData;
  let waitingConfirm = false;

  // Novos módulos de combate híbrido
  const combatUI  = new CombatUI(runtime, grid);   // menu de ações
  const highlight = new RangeHighlight(runtime, grid); // tiles alcançáveis
  const queue     = new TurnQueue();                // ordem de turnos

  // ---------------------------------------------------------------------------
  // Helpers de alcance
  // ---------------------------------------------------------------------------

  /** Retorna o range de ataque da arma equipada (ou 1 se sem arma). */
  function getWeaponRange() {
    return player.instVars.weaponAtq > 0 ? (player._weaponRange ?? 1) : 1;
  }

  // ---------------------------------------------------------------------------
  // Callbacks do CombatUI
  // ---------------------------------------------------------------------------

  combatUI.onSelect((action) => {
    if (!gameState.is(GameStates.COMBAT)) return;

    switch (action) {
      case CombatActions.MOVE:
        // Exibe tiles de movimento alcançáveis
        highlight.show(
          HighlightMode.MOVE,
          player,
          map,
          turns.enemies,
          player.instVars.mov_base
        );
        _awaitTileSelection('move');
        break;

      case CombatActions.ATTACK:
        // Exibe tiles de ataque alcançáveis
        highlight.show(
          HighlightMode.ATTACK,
          player,
          map,
          turns.enemies,
          getWeaponRange()
        );
        _awaitTileSelection('attack');
        break;

      case CombatActions.MAGIC:
      case CombatActions.DEFEND:
        // Placeholder — não faz nada no MVP
        combatUI.show(player);
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Seleção de tile após highlight
  // ---------------------------------------------------------------------------

  // Guarda o modo de seleção ativo ('move' | 'attack' | null)
  let _selectionMode = null;

  function _awaitTileSelection(mode) {
    _selectionMode = mode;
    _cursorIndex   = 0; // reseta cursor ao iniciar nova seleção
  }

  function _confirmTileSelection(tileX, tileY) {
    const mode   = _selectionMode;
    const tiles  = highlight.tiles; // captura ANTES de limpar
    _selectionMode = null;
    highlight.clear();

    if (mode === 'move') {
      _executeMoveAction(tileX, tileY, tiles);
    } else if (mode === 'attack') {
      _executeAttackAction(tileX, tileY, tiles);
    }
  }

  function _cancelTileSelection() {
    _selectionMode = null;
    highlight.clear();
    // Reabre o menu
    combatUI.show(player);
  }

  // ---------------------------------------------------------------------------
  // Ações do jogador no combate
  // ---------------------------------------------------------------------------

  function _executeMoveAction(tileX, tileY, reachable = []) {
    // Valida que o tile está na lista de alcançáveis (passada antes do clear)
    const valid = reachable.some(t => t.x === tileX && t.y === tileY);
    if (!valid) {
      console.warn(`[main] Tile (${tileX},${tileY}) fora do alcance — movimento cancelado.`);
      combatUI.show(player); // reabre menu
      return;
    }

    const pixel = grid.toPixel(tileX, tileY);
    player.x = pixel.x;
    player.y = pixel.y;

    _afterPlayerAction();
  }

  function _executeAttackAction(tileX, tileY, _reachable = []) {
    const target = turns.enemies.find(e => {
      if (e.isDead()) return false;
      const pos = grid.toGrid(e.x, e.y);
      return pos.x === tileX && pos.y === tileY;
    });

    if (!target) return;

    const damage = physicalAttack(player, target.sprite);
    console.log(`Jogador atacou ${target.name}: -${damage} HP (${target.hp}/${target.maxHp})`);

    if (target.isDead()) {
      console.log(`${target.name} foi derrotado!`);
      turns.removeEnemy(target);
      queue.syncEnemies(turns.enemies);
    }

    _afterPlayerAction();
  }

  function _afterPlayerAction() {
    _syncPlayerLight();
    hud?.update();

    // Verifica fim de combate por vitória
    if (turns.enemies.length === 0) {
      _endCombat('victory');
      return;
    }

    queue.playerDone();
  }

  // ---------------------------------------------------------------------------
  // Fim de combate
  // ---------------------------------------------------------------------------

  function _endCombat(reason) {
    highlight.clear();
    combatUI.hide();
    queue.reset();
    gameState.exitCombat(reason);

    if (reason === 'victory' && stairSprite && !stairSprite.isVisible) {
      spawnStair();
    }
  }

  // ---------------------------------------------------------------------------
  // Callbacks do TurnQueue
  // ---------------------------------------------------------------------------

  queue.onPlayerTurn(() => {
    if (!player) {
      console.warn('[TurnQueue] onPlayerTurn disparado antes de player existir.');
      return;
    }
    // Garante que o menu está limpo antes de abrir
    combatUI.hide();
    combatUI.show(player);
  });

  queue.onEnemiesTurn((enemies) => {
    // Executa IA de cada inimigo em sequência síncrona
    for (const enemy of enemies) {
      if (!enemy.isDead()) {
        enemy.act(map, grid, player, turns);
      }
    }
    hud?.update();

    // Verifica se o jogador morreu durante o turno dos inimigos
    if (player.instVars.hp_curr <= 0) {
      console.warn('[main] Jogador morreu!');
      _endCombat('defeat');
      // TODO: tela de game over
      return;
    }

    queue.enemiesDone();
  });

  queue.onRoundEnd((round) => {
    console.log(`[TurnQueue] Rodada ${round} encerrada.`);
    turns.enemies = turns.enemies.filter(e => !e.isDead());
    queue.syncEnemies(turns.enemies);
  });

  // ---------------------------------------------------------------------------
  // Callbacks do GameState
  // ---------------------------------------------------------------------------

  gameState.on('enterCombat', ({ enemies }) => {
    console.log(`[main] Entrando em combate com ${enemies.length} inimigo(s).`);
    queue.start(enemies);
  });

  gameState.on('exitCombat', ({ reason }) => {
    console.log(`[main] Saindo do combate — ${reason}.`);
    highlight.clear();
    combatUI.hide();
    queue.reset();
  });

  // ---------------------------------------------------------------------------
  // Detecção de combate durante exploração
  // ---------------------------------------------------------------------------

  /**
   * Verifica se algum inimigo avista o jogador após cada movimento.
   * Se sim, aciona enterCombat com todos os inimigos que têm LOS.
   */
  function _checkCombatTrigger() {
    if (!gameState.is(GameStates.EXPLORING)) return;

    const inSight = turns.enemies.filter(enemy => {
      if (enemy.isDead()) return false;
      return enemy._canSeePlayer(player, grid, map);
    });

    if (inSight.length > 0) {
      gameState.enterCombat(turns.enemies); // todos os inimigos da sala entram
    }
  }

  // ---------------------------------------------------------------------------
  // Carregamento de andar
  // ---------------------------------------------------------------------------

  async function loadFloor(floorIndex) {
    if (turns) {
      for (const enemy of turns.enemies) {
        enemy.sprite?.destroy();
        enemy._destroyHpBar();
      }
      turns.enemies = [];
    }

    gameState.exitCombat('victory');
    highlight.clear();
    combatUI.hide();
    queue.reset();

    const theme    = FLOOR_THEMES[floorIndex]      ?? 'cave';
    const maxRooms = FLOOR_ROOMS[floorIndex]        ?? 6;
    const family   = FLOOR_ENEMY_FAMILY[floorIndex] ?? 'goblins';

    map   = new GameMap(32, 32, maxRooms, theme);
    turns = new TurnManager();
    turns.onTurnStart((n) => console.log(`--- Andar ${floorIndex + 1} | Turno ${n} ---`));

    const factory = new EnemyFactory(enemiesData.families[family]);
    const start   = map.getPlayerStart();
    map.render(tileset);

    const pos = grid.toPixel(start.x, start.y);
    player.x  = pos.x;
    player.y  = pos.y;

    for (const roomSpawns of map.getEnemySpawns(2)) {
      const count    = randomInt(1, 2);
      const selected = roomSpawns.slice(0, count);
      for (const sp of selected) {
        const enemy = factory.spawn(sp.x, sp.y, grid, runtime);
        if (enemy) turns.addEnemy(enemy);
      }
    }

    if (stairSprite) stairSprite.isVisible = false;
    console.log(`✔ Andar ${floorIndex + 1} | ${turns.enemies.length} inimigo(s) | tema: ${theme}`);
  }

  // ---------------------------------------------------------------------------
  // Escada e progressão
  // ---------------------------------------------------------------------------

  function checkFloorClear(playerGridX, playerGridY) {
    if (!stairSprite || !stairSprite.isVisible) return;
    const stairPos = grid.toGrid(stairSprite.x, stairSprite.y);
    const onStair  = stairPos.x === playerGridX && stairPos.y === playerGridY;

    if (onStair && !waitingConfirm) {
      waitingConfirm = true;
      console.log('[DEBUG] Jogador na escada — pressione Enter ou Espaço para descer.');
    } else if (!onStair) {
      waitingConfirm = false;
    }
  }

  function spawnStair() {
    if (!stairSprite) return;
    const playerPos = grid.toGrid(player.x, player.y);
    const target    = findFloorNearPlayer(playerPos.x, playerPos.y, 2);
    if (!target) return;

    const pixel           = grid.toPixel(target.x, target.y);
    stairSprite.x         = pixel.x;
    stairSprite.y         = pixel.y;
    stairSprite.isVisible = true;
    waitingConfirm        = false;
    console.log(`Escada revelada em (${target.x}, ${target.y})`);
  }

  function findFloorNearPlayer(px, py, distance) {
    for (let d = distance; d <= distance + 2; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue;
          if (map.isFloor(px + dx, py + dy)) return { x: px + dx, y: py + dy };
        }
      }
    }
    return null;
  }

  async function advanceFloor() {
    if (currentFloor >= FLOOR_THEMES.length - 1) {
      console.log('🏆 Jogo concluído!');
      return;
    }
    currentFloor++;
    await loadFloor(currentFloor);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function _syncPlayerLight() {
    if (playerLight) {
      playerLight.x = player.x + grid.tileSize / 2;
      playerLight.y = player.y + grid.tileSize / 2;
    }
  }

  // ---------------------------------------------------------------------------
  // beforeprojectstart
  // ---------------------------------------------------------------------------

  runtime.addEventListener('beforeprojectstart', async () => {
    try {
      OnBeforeProjectStart(runtime);

      player      = runtime.objects.player.getFirstInstance();
      tileset     = runtime.objects.simpleTileset.getFirstInstance();
      stairSprite = runtime.objects.Stair?.getFirstInstance()        ?? null;
      playerLight = runtime.objects.player_light?.getFirstInstance() ?? null;
      darkness    = runtime.layout.getLayer('Darkness');

      if (!stairSprite) console.warn('[main] "Stair" não encontrado.');
      if (!playerLight) console.warn('[main] "player_light" não encontrado.');

      player.takeDamage = (amount) => {
        player.instVars.hp_curr = Math.max(0, player.instVars.hp_curr - amount);
        hud?.update();
        console.log(`Jogador HP: ${player.instVars.hp_curr}/${player.instVars.hp_max}`);
      };

      enemiesData = await runtime.assets.fetchJson('enemies.json');
      console.log('✔ JSON carregado');

      await loadFloor(currentFloor);

      hud = new HUD(runtime, player);
      initDebug(runtime, { darkness, playerLight });

      console.log('✔ Jogo iniciado');
    } catch (err) {
      console.error('ERRO em beforeprojectstart:', err);
    }
  });

  // ---------------------------------------------------------------------------
  // Input — bifurca por estado do jogo
  // ---------------------------------------------------------------------------

  runtime.addEventListener('keydown', async (event) => {
    if (!map || !turns) return;

    // ── Confirmação de descida de andar (qualquer estado) ──
    if ((event.key === 'Enter' || event.key === ' ') && waitingConfirm) {
      waitingConfirm = false;
      await advanceFloor();
      return;
    }

    // ── MODO EXPLORAÇÃO ──
    if (gameState.is(GameStates.EXPLORING)) {
      _handleExplorationInput(event);
      return;
    }

    // ── MODO COMBATE ──
    if (gameState.is(GameStates.COMBAT)) {
      // Menu de ações tem prioridade — consome o evento se estiver visível
      if (combatUI.isVisible) {
        combatUI.handleInput(event);
        return;
      }
      // Seleção de tile após escolher ação
      if (_selectionMode && queue.isPlayerTurn) {
        _handleTileSelectionInput(event);
        return;
      }
    }
  });

  function _handleExplorationInput(event) {
    let dx = 0, dy = 0;

    switch (event.key) {
      case 'ArrowUp':    case 'w': case 'W': dy = -1; break;
      case 'ArrowDown':  case 's': case 'S': dy =  1; break;
      case 'ArrowLeft':  case 'a': case 'A': dx = -1; break;
      case 'ArrowRight': case 'd': case 'D': dx =  1; break;
      default: return;
    }

    // Atualiza frame de animação
    if (dx === -1) player.animationFrame = 1;
    if (dx ===  1) player.animationFrame = 0;

    // Movimento simples — sem bump attack na exploração
    const pos  = grid.toGrid(player.x, player.y);
    const newX = pos.x + dx;
    const newY = pos.y + dy;

    if (map.isWall(newX, newY)) return;

    // Verifica se há inimigo no tile — não atravessa, aciona combate
    const blocked = turns.enemies.find(e => {
      if (e.isDead()) return false;
      const ep = grid.toGrid(e.x, e.y);
      return ep.x === newX && ep.y === newY;
    });

    if (blocked) {
      // Tentar entrar no tile de um inimigo aciona o combate imediatamente
      gameState.enterCombat(turns.enemies);
      return;
    }

    const pixel = grid.toPixel(newX, newY);
    player.x = pixel.x;
    player.y = pixel.y;

    _syncPlayerLight();
    _checkCombatTrigger();

    const playerPos = grid.toGrid(player.x, player.y);
    if (turns.enemies.length === 0 && stairSprite && !stairSprite.isVisible) {
      spawnStair();
      return;
    }
    checkFloorClear(playerPos.x, playerPos.y);
  }

  /**
   * Navega entre os tiles destacados com setas.
   * Enter/Espaço confirma. Escape cancela e reabre o menu.
   *
   * Mantém um cursor interno sobre os tiles alcançáveis.
   */
  let _cursorIndex = 0;

  function _handleTileSelectionInput(event) {
    const tiles = highlight.tiles;
    if (tiles.length === 0) return;

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        // Navega para o tile mais próximo na direção pressionada
        const dirs = {
          ArrowUp:    { dx:  0, dy: -1 },
          ArrowDown:  { dx:  0, dy:  1 },
          ArrowLeft:  { dx: -1, dy:  0 },
          ArrowRight: { dx:  1, dy:  0 },
        };
        const { dx, dy } = dirs[event.key];
        const current = tiles[_cursorIndex] ?? tiles[0];

        // Encontra o tile mais próximo na direção dada
        let best = null;
        let bestScore = Infinity;

        for (let i = 0; i < tiles.length; i++) {
          const t = tiles[i];
          if (t === current) continue;

          const relX = t.x - current.x;
          const relY = t.y - current.y;

          // Penaliza tiles que não estão na direção correta
          const alignment = relX * dx + relY * dy;
          if (alignment <= 0) continue;

          const dist = Math.abs(relX) + Math.abs(relY);
          if (dist < bestScore) {
            bestScore = dist;
            best      = i;
          }
        }

        if (best !== null) _cursorIndex = best;
        break;
      }

      case 'Enter':
      case ' ': {
        const tile = tiles[_cursorIndex] ?? tiles[0];
        if (tile) _confirmTileSelection(tile.x, tile.y);
        break;
      }

      case 'Escape':
        _cancelTileSelection();
        break;
    }
  }
});