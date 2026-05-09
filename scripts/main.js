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
import { initDebug }                           from './debug.js';

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

  let map;
  let turns;
  let player;
  let tileset;
  let stairSprite;
  let playerLight;
  let darkness;
  let hud;
  let enemiesData;
  let waitingConfirm = false;

  const combatUI  = new CombatUI(runtime, grid);
  const highlight = new RangeHighlight(runtime, grid);
  const queue     = new TurnQueue();

  function getWeaponRange() {
    return player.instVars.weaponAtq > 0 ? (player._weaponRange ?? 1) : 1;
  }

  function _cleanupCombatState() {
    highlight.clear();
    combatUI.hide();
    queue.reset();
    _selectionMode = null;
  }

  combatUI.onSelect((action) => {
    if (!gameState.is(GameStates.COMBAT)) return;

    switch (action) {
      case CombatActions.MOVE:
        highlight.show(HighlightMode.MOVE, player, map, turns.enemies, player.instVars.mov_base);
        _awaitTileSelection('move');
        break;

      case CombatActions.ATTACK:
        highlight.show(HighlightMode.ATTACK, player, map, turns.enemies, getWeaponRange());
        _awaitTileSelection('attack');
        break;

      default:
        combatUI.show(player);
        break;
    }
  });

  let _selectionMode = null;

  function _awaitTileSelection(mode) {
    _selectionMode = mode;
  }

  function _confirmTileSelection(tileX, tileY) {
    const mode = _selectionMode;

    _selectionMode = null;
    highlight.clear();

    if (mode === 'move') {
      _executeMoveAction(tileX, tileY);
    }

    if (mode === 'attack') {
      _executeAttackAction(tileX, tileY);
    }
  }

  function _cancelTileSelection() {
    _selectionMode = null;
    highlight.clear();
    combatUI.show(player);
  }

  function _executeMoveAction(tileX, tileY) {
    const pixel = grid.toPixel(tileX, tileY);

    player.x = pixel.x;
    player.y = pixel.y;

    _afterPlayerAction();
  }

  function _executeAttackAction(tileX, tileY) {
    const target = turns.enemies.find(e => {
      if (e.isDead()) return false;
      const pos = grid.toGrid(e.x, e.y);
      return pos.x === tileX && pos.y === tileY;
    });

    if (!target) {
      combatUI.show(player);
      return;
    }

    const damage = physicalAttack(player, target.sprite);

    console.log(`Jogador atacou ${target.name}: -${damage} HP (${target.hp}/${target.maxHp})`);

    if (target.hp <= 0 && !target.isDead()) {
      target.takeDamage(0);
      turns.removeEnemy(target);
      queue.syncEnemies(turns.enemies);
    }

    _afterPlayerAction();
  }

  function _afterPlayerAction() {
    _syncPlayerLight();
    hud?.update();

    const aliveEnemies = turns.enemies.filter(e => !e.isDead());

    if (aliveEnemies.length === 0) {
      turns.enemies = [];
      _endCombat('victory');
      return;
    }

    queue.playerDone();
  }

  function _endCombat(reason) {
    _cleanupCombatState();
    gameState.exitCombat(reason);

    if (reason === 'victory' && stairSprite && !stairSprite.isVisible) {
      spawnStair();
    }
  }

  queue.onPlayerTurn(() => {
    combatUI.hide();
    combatUI.show(player);
  });

  queue.onEnemiesTurn((enemies) => {
    for (const enemy of enemies) {
      if (!enemy.isDead()) {
        enemy.act(map, grid, player, turns);
      }
    }

    turns.enemies = turns.enemies.filter(e => !e.isDead());
    queue.syncEnemies(turns.enemies);

    hud?.update();

    if (player.instVars.hp_curr <= 0) {
      _endCombat('defeat');
      return;
    }

    if (turns.enemies.length === 0) {
      _endCombat('victory');
      return;
    }

    queue.enemiesDone();
  });

  gameState.on('enterCombat', ({ enemies }) => {
    queue.start(enemies);
  });

  gameState.on('exitCombat', () => {
    _cleanupCombatState();
  });

  async function loadFloor(floorIndex) {
    _cleanupCombatState();

    if (turns) {
      for (const enemy of turns.enemies) {
        enemy.sprite?.destroy();
        enemy._destroyHpBar();
      }

      turns.enemies = [];
    }

    const theme = FLOOR_THEMES[floorIndex] ?? 'cave';
    const maxRooms = FLOOR_ROOMS[floorIndex] ?? 6;
    const family = FLOOR_ENEMY_FAMILY[floorIndex] ?? 'goblins';

    map = new GameMap(32, 32, maxRooms, theme);
    turns = new TurnManager();

    const factory = new EnemyFactory(enemiesData.families[family]);
    const start = map.getPlayerStart();

    map.render(tileset);

    const pos = grid.toPixel(start.x, start.y);
    player.x = pos.x;
    player.y = pos.y;

    // Buff do MVP para evitar sensação de combate injusto.
    player.instVars.atq_base = 3;
    player.instVars.def_base = 2;

    for (const roomSpawns of map.getEnemySpawns(2)) {
      const count = randomInt(1, 2);
      const selected = roomSpawns.slice(0, count);

      for (const sp of selected) {
        const enemy = factory.spawn(sp.x, sp.y, grid, runtime);
        if (enemy) turns.addEnemy(enemy);
      }
    }

    if (stairSprite) {
      stairSprite.isVisible = false;
    }

    hud?.update();
  }

  function spawnStair() {
    if (!stairSprite) return;

    const playerPos = grid.toGrid(player.x, player.y);
    const target = { x: playerPos.x + 2, y: playerPos.y };

    const pixel = grid.toPixel(target.x, target.y);

    stairSprite.x = pixel.x;
    stairSprite.y = pixel.y;
    stairSprite.isVisible = true;
  }

  function _syncPlayerLight() {
    if (!playerLight) return;

    playerLight.x = player.x + grid.tileSize / 2;
    playerLight.y = player.y + grid.tileSize / 2;
  }

  runtime.addEventListener('beforeprojectstart', async () => {
    player = runtime.objects.player.getFirstInstance();
    tileset = runtime.objects.simpleTileset.getFirstInstance();
    stairSprite = runtime.objects.Stair?.getFirstInstance() ?? null;
    playerLight = runtime.objects.player_light?.getFirstInstance() ?? null;
    darkness = runtime.layout.getLayer('Darkness');

    enemiesData = await runtime.assets.fetchJson('enemies.json');

    await loadFloor(currentFloor);

    hud = new HUD(runtime, player);

    initDebug(runtime, { darkness, playerLight });
  });

  runtime.addEventListener('keydown', async (event) => {
    if (!map || !turns) return;

    if (gameState.is(GameStates.COMBAT)) {
      if (combatUI.isVisible) {
        combatUI.handleInput(event);
        return;
      }

      if (_selectionMode) {
        switch (event.key) {
          case 'ArrowUp':
            highlight.moveSelection(0, -1);
            return;

          case 'ArrowDown':
            highlight.moveSelection(0, 1);
            return;

          case 'ArrowLeft':
            highlight.moveSelection(-1, 0);
            return;

          case 'ArrowRight':
            highlight.moveSelection(1, 0);
            return;

          case 'Enter':
          case ' ': {
            const tile = highlight.selectedTile;
            if (tile) {
              _confirmTileSelection(tile.x, tile.y);
            }
            return;
          }

          case 'Escape':
            _cancelTileSelection();
            return;
        }
      }
    }
  });
});