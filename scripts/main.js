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
const DEFEND_BONUS       = 2;

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
  let combatEnemies = [];
  let defendActive = false;

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
    combatEnemies = [];

    if (defendActive) {
      player.instVars.def_base -= DEFEND_BONUS;
      defendActive = false;
    }
  }

  function _syncCombatEnemies() {
    combatEnemies = combatEnemies.filter(e => !e.isDead());
    queue.syncEnemies(combatEnemies);
  }

  function _getAliveFloorEnemies() {
    return turns.enemies.filter(e => !e.isDead());
  }

  combatUI.onSelect((action) => {
    if (!gameState.is(GameStates.COMBAT)) return;

    switch (action) {
      case CombatActions.MOVE:
        highlight.show(HighlightMode.MOVE, player, map, turns.enemies, player.instVars.mov_base);
        _awaitTileSelection('move');
        break;

      case CombatActions.ATTACK:
        highlight.show(HighlightMode.ATTACK, player, map, combatEnemies, getWeaponRange());
        _awaitTileSelection('attack');
        break;

      case CombatActions.DEFEND:
        _executeDefendAction();
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
    const tiles = highlight.tiles;

    _selectionMode = null;
    highlight.clear();

    if (mode === 'move') {
      _executeMoveAction(tileX, tileY, tiles);
    }

    if (mode === 'attack') {
      _executeAttackAction(tileX, tileY, tiles);
    }
  }

  function _cancelTileSelection() {
    _selectionMode = null;
    highlight.clear();
    combatUI.show(player);
  }

  function _executeDefendAction() {
    if (!defendActive) {
      player.instVars.def_base += DEFEND_BONUS;
      defendActive = true;
    }

    _afterPlayerAction();
  }

  function _executeMoveAction(tileX, tileY, reachable = []) {
    const valid = reachable.some(t => t.x === tileX && t.y === tileY);

    if (!valid) {
      combatUI.show(player);
      return;
    }

    const pixel = grid.toPixel(tileX, tileY);
    player.x = pixel.x;
    player.y = pixel.y;

    _afterPlayerAction();
  }

  function _executeAttackAction(tileX, tileY) {
    const target = combatEnemies.find(e => {
      if (e.isDead()) return false;
      const pos = grid.toGrid(e.x, e.y);
      return pos.x === tileX && pos.y === tileY;
    });

    if (!target) {
      combatUI.show(player);
      return;
    }

    const damage = physicalAttack(player, target.sprite);

    target._updateHpBar?.();

    if (target.hp <= 0 && !target.isDead()) {
      target.takeDamage(0);
      turns.removeEnemy(target);
      combatEnemies = combatEnemies.filter(e => e !== target);
      _syncCombatEnemies();
    }

    _afterPlayerAction();
  }

  function _afterPlayerAction() {
    _syncPlayerLight();
    hud?.update();
    _syncCombatEnemies();

    if (combatEnemies.length === 0) {
      _endCombat('victory');
      return;
    }

    queue.playerDone();
  }

  function _endCombat(reason) {
    const remainingFloorEnemies = _getAliveFloorEnemies();
    _cleanupCombatState();
    gameState.exitCombat(reason);

    if (reason === 'victory' && remainingFloorEnemies.length === 0 && stairSprite && !stairSprite.isVisible) {
      spawnStair();
    }
  }

  queue.onPlayerTurn(() => {
    if (defendActive) {
      player.instVars.def_base -= DEFEND_BONUS;
      defendActive = false;
    }

    if (!player) return;

    combatUI.hide();
    combatUI.show(player);
  });

  queue.onEnemiesTurn((enemies) => {
    for (const enemy of enemies) {
      if (!enemy.isDead()) {
        enemy.act(map, grid, player, turns);
      }
    }

    turns.enemies = _getAliveFloorEnemies();
    combatEnemies = combatEnemies.filter(e => !e.isDead());
    queue.syncEnemies(combatEnemies);

    hud?.update();

    if (player.instVars.hp_curr <= 0) {
      _endCombat('defeat');
      return;
    }

    if (combatEnemies.length === 0) {
      _endCombat('victory');
      return;
    }

    queue.enemiesDone();
  });

  queue.onRoundEnd(() => {
    turns.enemies = _getAliveFloorEnemies();
    _syncCombatEnemies();
  });

  gameState.on('enterCombat', ({ enemies }) => {
    combatEnemies = enemies.filter(e => !e.isDead());

    if (combatEnemies.length === 0) {
      gameState.exitCombat('victory');
      return;
    }

    queue.start(combatEnemies);
  });

  gameState.on('exitCombat', () => {
    _cleanupCombatState();
  });
});