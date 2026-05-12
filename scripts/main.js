import { physicalAttack } from './combat.js';
import { randomInt } from './utils.js';
import { Grid } from './grid.js';
import { GameMap } from './map.js';
import { TurnManager, EnemyFactory } from './turn.js';
import { HUD } from './hud.js';
import { gameState, GameStates } from './gameState.js';
import { CombatUI, CombatActions } from './combatUI.js';
import { RangeHighlight, HighlightMode } from './rangeHighlight.js';
import { TurnQueue } from './turnQueue.js';
import { initDebug } from './debug.js';

const FLOOR_THEMES = ['cave', 'cave', 'cave'];
const FLOOR_ROOMS = [6, 8, 10];
const FLOOR_ENEMY_FAMILY = ['goblins', 'goblins', 'goblins'];
const DEFEND_BONUS = 2;

let currentFloor = 0;

async function OnBeforeProjectStart(runtime) {
  runtime.addEventListener('tick', () => Tick(runtime));
}

function Tick(runtime) { }

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
  let defeatQuotes = [];
  let txtPressR;
  let txtGameOver;
  let gameOverLayer;
  let waitingConfirm = false;
  let combatEnemies = [];
  let defendActive = false;
  let victoryLayer;
  let transitionLayer;
  let isTransitioning = false;

  const combatUI = new CombatUI(runtime, grid);
  const highlight = new RangeHighlight(runtime, grid);
  const queue = new TurnQueue();

  function _showGameOverScreen() {
    if (gameOverLayer) {
      gameOverLayer.isVisible = true;
      gameOverLayer.opacity = 1;
    }

    if (txtPressR) {
      txtPressR.isVisible = true;
      txtPressR.text = 'Pressione R para reiniciar';
    }

    if (txtGameOver) {
      txtGameOver.isVisible = true;

      if (Array.isArray(defeatQuotes) && defeatQuotes.length > 0) {
        txtGameOver.text = defeatQuotes[randomInt(0, defeatQuotes.length - 1)];
      }
      else {
        txtGameOver.text = 'Perdeu Playboy';
      }
    }
  }

  function _triggerGameOver() {
    console.warn('[main] GAME OVER');

    _cleanupCombatState();
    gameState.enterGameOver('playerDead');
    _showGameOverScreen();
  }

  async function _restartRun() {
    console.warn('[main] Reiniciando run...');

    currentFloor = 0;

    if (gameOverLayer) {
      gameOverLayer.isVisible = false;
    }

    if (txtPressR) {
      txtPressR.isVisible = false;
    }

    if (txtGameOver) {
      txtGameOver.isVisible = false;
    }

    gameState.reset();

    player.instVars.hp_curr = player.instVars.hp_max;

    await loadFloor(currentFloor);

    hud?.update();
  }

  async function _fadeLayer(layer, targetOpacity, durationMs) {
    if (!layer) return;

    const startOpacity = layer.opacity;
    const startTime = performance.now();

    return new Promise(resolve => {

      function step(now) {
        const t = Math.min((now - startTime) / durationMs, 1);

        layer.opacity = startOpacity + ((targetOpacity - startOpacity) * t);

        if (t >= 1) {
          resolve();
          return;
        }

        requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    });
  }

  async function _flashSprite(sprite) {

    if (!sprite) return;

    const originalOpacity = sprite.opacity;

    sprite.opacity = 0.2;

    await new Promise(r => setTimeout(r, 80));

    sprite.opacity = originalOpacity;
  }

  async function _fadeAndDestroyEnemy(enemy) {

    if (!enemy?.sprite) return;

    const sprite = enemy.sprite;

    const start = performance.now();
    const duration = 1500;

    return new Promise(resolve => {

      function step(now) {

        const t = Math.min((now - start) / duration, 1);

        sprite.opacity = 1 - t;

        if (t >= 1) {

          enemy._destroyHpBar?.();
          sprite.destroy();

          resolve();
          return;
        }

        requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    });
  }


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

    console.log(`[Combat] Jogador entrou em defesa (+${DEFEND_BONUS} DEF).`);

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

    if (damage > 0) {

      runtime.callFunction('atk_hit');

      _flashSprite(target.sprite);
    }
    else {

      runtime.callFunction('atk_miss');
    }

    target._updateHpBar?.();
    console.log(`Jogador atacou ${target.name}: -${damage} HP (${target.hp}/${target.maxHp})`);

    if (target.hp <= 0 && !target.isDead()) {
      target.takeDamage(0);

      _fadeAndDestroyEnemy(target);

      turns.removeEnemy(target);
      combatEnemies = combatEnemies.filter(e => e !== target);
      _syncCombatEnemies();
      console.log(`${target.name} foi derrotado!`);
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

  async function _triggerVictory() {

    if (isTransitioning) return;

    isTransitioning = true;

    _cleanupCombatState();

    if (victoryLayer) {
      victoryLayer.isVisible = true;

      await _fadeLayer(victoryLayer, 1, 2000);
    }

    await new Promise(r => setTimeout(r, 3000));

    if (transitionLayer) {
      await _fadeLayer(transitionLayer, 1, 2000);
    }

    runtime.goToLayout('title_screen');
  }

  function _endCombat(reason) {
    const remainingFloorEnemies = _getAliveFloorEnemies();
    _cleanupCombatState();
    gameState.exitCombat(reason);

    if (reason === 'victory' && remainingFloorEnemies.length === 0) {

      if (currentFloor >= FLOOR_THEMES.length - 1) {
        _triggerVictory();
        return;
      }

      if (stairSprite && !stairSprite.isVisible) {
        spawnStair();
      }
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
      _triggerGameOver();
      return;
    }

    if (combatEnemies.length === 0) {
      _endCombat('victory');
      return;
    }

    queue.enemiesDone();
  });

  queue.onRoundEnd((round) => {
    console.log(`[TurnQueue] Rodada ${round} encerrada.`);
    turns.enemies = _getAliveFloorEnemies();
    _syncCombatEnemies();
  });

  gameState.on('enterCombat', ({ enemies }) => {
    combatEnemies = enemies.filter(e => !e.isDead());

    console.log(`[main] Entrando em combate com ${combatEnemies.length} inimigo(s).`);

    if (combatEnemies.length === 0) {
      gameState.exitCombat('victory');
      return;
    }

    queue.start(combatEnemies);
  });

  gameState.on('exitCombat', ({ reason }) => {
    console.log(`[main] Saindo do combate — ${reason}.`);
    _cleanupCombatState();
  });

  function _checkCombatTrigger() {
    if (!gameState.is(GameStates.EXPLORING)) return;

    const inSight = turns.enemies.filter(enemy => {
      if (enemy.isDead()) return false;
      return enemy._canSeePlayer(player, grid, map);
    });

    if (inSight.length > 0) {
      gameState.enterCombat(inSight);
    }
  }

  async function loadFloor(floorIndex) {
    _cleanupCombatState();

    if (turns) {
      for (const enemy of turns.enemies) {
        enemy.sprite?.destroy();
        enemy._destroyHpBar();
      }

      turns.enemies = [];
    }

    waitingConfirm = false;

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

    console.log(`✔ Andar ${floorIndex + 1} carregado com ${turns.enemies.length} inimigo(s).`);
  }

  function checkFloorClear(playerGridX, playerGridY) {
    if (!stairSprite || !stairSprite.isVisible) return;

    const stairPos = grid.toGrid(stairSprite.x, stairSprite.y);
    const onStair = stairPos.x === playerGridX && stairPos.y === playerGridY;

    if (onStair && !waitingConfirm) {
      waitingConfirm = true;
      console.log('[DEBUG] Jogador na escada — pressione Enter ou Espaço para descer.');
    }

    if (!onStair) {
      waitingConfirm = false;
    }
  }

  function spawnStair() {
    if (!stairSprite) return;

    const playerPos = grid.toGrid(player.x, player.y);
    const target = findFloorNearPlayer(playerPos.x, playerPos.y, 2);

    if (!target) return;

    const pixel = grid.toPixel(target.x, target.y);

    stairSprite.x = pixel.x;
    stairSprite.y = pixel.y;
    stairSprite.isVisible = true;

    waitingConfirm = false;

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
      console.log('🏆 MVP concluído!');
      return;
    }

    currentFloor++;
    await loadFloor(currentFloor);
  }

  function _syncPlayerLight() {
    if (!playerLight) return;

    playerLight.x = player.x + grid.tileSize / 2;
    playerLight.y = player.y + grid.tileSize / 2;
  }

  runtime.addEventListener('beforeprojectstart', async () => {
    OnBeforeProjectStart(runtime);
  });

  runtime.addEventListener('afteranylayoutstart', async () => {
    try {
      if (runtime.layout.name !== 'game') {
        return;
      }

      isTransitioning = false;

      player = runtime.objects.player.getFirstInstance();
      tileset = runtime.objects.simpleTileset.getFirstInstance();
      stairSprite = runtime.objects.Stair?.getFirstInstance() ?? null;
      playerLight = runtime.objects.player_light?.getFirstInstance() ?? null;
      darkness = runtime.layout.getLayer('Darkness');
      gameOverLayer = runtime.layout.getLayer('GameOver');
      victoryLayer = runtime.layout.getLayer('Victory');
      transitionLayer = runtime.layout.getLayer('Transition');

      if (victoryLayer) {
        victoryLayer.isVisible = false;
        victoryLayer.opacity = 0;
      }

      if (transitionLayer) {
        transitionLayer.opacity = 0;
      }

      txtPressR = runtime.objects.txt_pressR?.getFirstInstance() ?? null;
      txtGameOver = runtime.objects.txt_GameOver?.getFirstInstance() ?? null;

      if (gameOverLayer) {
        gameOverLayer.isVisible = false;
      }

      if (txtPressR) txtPressR.isVisible = false;
      if (txtGameOver) txtGameOver.isVisible = false;

      enemiesData = await runtime.assets.fetchJson('enemies.json');

      try {
        defeatQuotes = await runtime.assets.fetchJson('frasesDerrota.json');
      }
      catch {
        defeatQuotes = [];
      }

      currentFloor = 0;
      gameState.reset();

      await loadFloor(currentFloor);

      hud = new HUD(runtime, player);

      initDebug(runtime, { darkness, playerLight });

      console.log('✔ Layout game iniciado');
    }
    catch (err) {
      console.error('ERRO ao iniciar layout game:', err);
    }
  });

  runtime.addEventListener('keydown', async (event) => {
    if (runtime.layout.name === 'title_screen') {
      if (isTransitioning) return;

      if (event.key === 'Enter') {
        isTransitioning = true;
        runtime.goToLayout('game');
      }

      return;
    }

    if (!map || !turns) return;

    if (gameState.is(GameStates.GAMEOVER)) {

      if (event.key === 'r' || event.key === 'R') {
        await _restartRun();
      }
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && waitingConfirm) {
      waitingConfirm = false;
      await advanceFloor();
      return;
    }

    if (gameState.is(GameStates.EXPLORING)) {
      _handleExplorationInput(event);
      return;
    }

    if (gameState.is(GameStates.COMBAT)) {
      if (combatUI.isVisible) {
        combatUI.handleInput(event);
        return;
      }

      if (_selectionMode && queue.isPlayerTurn) {
        _handleTileSelectionInput(event);
      }
    }
  });

  function _handleExplorationInput(event) {
    let dx = 0;
    let dy = 0;

    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        dy = -1;
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        dy = 1;
        break;

      case 'ArrowLeft':
      case 'a':
      case 'A':
        dx = -1;
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        dx = 1;
        break;

      default:
        return;
    }

    const pos = grid.toGrid(player.x, player.y);
    const newX = pos.x + dx;
    const newY = pos.y + dy;

    if (map.isWall(newX, newY)) return;

    const blocked = turns.enemies.find(e => {
      if (e.isDead()) return false;
      const ep = grid.toGrid(e.x, e.y);
      return ep.x === newX && ep.y === newY;
    });

    if (blocked) {
      gameState.enterCombat([blocked]);
      return;
    }

    const pixel = grid.toPixel(newX, newY);
    player.x = pixel.x;
    player.y = pixel.y;
    runtime.callFunction('playerStep');

    _syncPlayerLight();
    _checkCombatTrigger();

    const playerPos = grid.toGrid(player.x, player.y);

    if (_getAliveFloorEnemies().length === 0 && stairSprite && !stairSprite.isVisible) {
      spawnStair();
      return;
    }

    checkFloorClear(playerPos.x, playerPos.y);
  }

  function _handleTileSelectionInput(event) {
    switch (event.key) {
      case 'Escape':
        _cancelTileSelection();
        return;
    }

    if (!highlight.hasTiles) return;

    switch (event.key) {
      case 'ArrowUp':
        highlight.moveSelection(0, -1);
        break;

      case 'ArrowDown':
        highlight.moveSelection(0, 1);
        break;

      case 'ArrowLeft':
        highlight.moveSelection(-1, 0);
        break;

      case 'ArrowRight':
        highlight.moveSelection(1, 0);
        break;

      case 'Enter':
      case ' ': {
        const tile = highlight.selectedTile;
        if (tile) {
          _confirmTileSelection(tile.x, tile.y);
        }
        break;
      }
    }
  }
});