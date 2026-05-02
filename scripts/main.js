import { physicalAttack }            from './combat.js';
import { randomInt }                 from './utils.js';
import { Grid }                      from './grid.js';
import { GameMap }                   from './map.js';
import { TurnManager, EnemyFactory } from './turn.js';
import { HUD }                       from './hud.js';
import { initDebug }                 from './debug.js'; // remover em produção

// ---------------------------------------------------------------------------
// Estado global do jogo
// ---------------------------------------------------------------------------

const FLOOR_THEMES       = ['cave', 'cave', 'cave'];
const FLOOR_ROOMS        = [6, 8, 10];
const FLOOR_ENEMY_FAMILY = ['goblins', 'goblins', 'goblins'];

let currentFloor = 0;

async function OnBeforeProjectStart(runtime) {
  runtime.addEventListener('tick', () => Tick(runtime));
}

function Tick(runtime) {
  // Animações, UI contínua, etc.
}

runOnStartup(async (runtime) => {
  const grid = new Grid(16);

  let map;
  let turns;
  let player;
  let tileset;
  let stairSprite;
  let playerLight;
  let darkness;
  let waitingConfirm = false;
  let hud;
  let enemiesData;

  // ---------------------------------------------------------------------------
  // Inicializa um andar completo
  // ---------------------------------------------------------------------------
  async function loadFloor(floorIndex) {
    if (turns) {
      for (const enemy of turns.enemies) {
        enemy.sprite?.destroy();
        enemy._destroyHpBar();
      }
      turns.enemies = [];
    }

    const theme    = FLOOR_THEMES[floorIndex]       ?? 'cave';
    const maxRooms = FLOOR_ROOMS[floorIndex]         ?? 6;
    const family   = FLOOR_ENEMY_FAMILY[floorIndex]  ?? 'goblins';

    map   = new GameMap(32, 32, maxRooms, theme);
    turns = new TurnManager();
    turns.onTurnStart((n) => console.log(`--- Andar ${floorIndex + 1} | Turno ${n} ---`));

    const factory = new EnemyFactory(enemiesData.families[family]);

    const start = map.getPlayerStart();
    map.render(tileset);

    // Posiciona jogador
    const pos = grid.toPixel(start.x, start.y);
    player.x  = pos.x;
    player.y  = pos.y;

    // Spawna inimigos
    for (const roomSpawns of map.getEnemySpawns(2)) {
      const count    = randomInt(1, 2);
      const selected = roomSpawns.slice(0, count);
      for (const sp of selected) {
        const enemy = factory.spawn(sp.x, sp.y, grid, runtime);
        if (enemy) turns.addEnemy(enemy);
      }
    }
    console.log(`✔ Andar ${floorIndex + 1} | ${turns.enemies.length} inimigo(s) | tema: ${theme}`);

    if (stairSprite) stairSprite.isVisible = false;
  }

  // ---------------------------------------------------------------------------
  // Progressão de andar
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

    if (!target) {
      console.warn('[main] Não foi possível encontrar tile válido para a escada.');
      return;
    }

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
          const tx = px + dx;
          const ty = py + dy;
          if (map.isFloor(tx, ty)) return { x: tx, y: ty };
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

      if (!stairSprite)  console.warn('[main] "Stair" não encontrado — progressão desativada.');
      if (!playerLight)  console.warn('[main] "player_light" não encontrado — luz desativada.');

      // ---------------------------------------------------------------------------
      // takeDamage do jogador — escreve direto nas instVars (família baseStats)
      // ---------------------------------------------------------------------------
      player.takeDamage = (amount) => {
        player.instVars.hp_curr = Math.max(0, player.instVars.hp_curr - amount);
        hud?.update();
        console.log(`Jogador HP: ${player.instVars.hp_curr}/${player.instVars.hp_max}`);
        if (player.instVars.hp_curr === 0) {
          console.warn('Jogador morreu!');
          // TODO: tela de game over
        }
      };

      // ---------------------------------------------------------------------------
      // instVars do jogador também precisam expor def_base e atq_base
      // para que physicalAttack() funcione com o sprite diretamente.
      // weaponAtq é instVar exclusiva do Player (não está na família).
      // ---------------------------------------------------------------------------

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
  // Input
  // ---------------------------------------------------------------------------
  runtime.addEventListener('keydown', async (event) => {
    if (!map || !turns) return;

    let action = null;

    // bumpAttack recebe o sprite do inimigo diretamente — physicalAttack lê instVars
    const bumpAttack = (actor, target) => {
      const damage = physicalAttack(actor, target.sprite);
      console.log(`Jogador atacou ${target.name}: -${damage} HP (${target.hp}/${target.maxHp})`);
      if (target.isDead()) {
        console.log(`${target.name} foi derrotado!`);
        turns.removeEnemy(target);
      }
    };

    switch (event.key) {
      case 'ArrowUp':
      case 'w': case 'W':
        action = () => grid.move(player, 0, -1, map, turns.enemies, bumpAttack);
        break;
      case 'ArrowDown':
      case 's': case 'S':
        action = () => grid.move(player, 0,  1, map, turns.enemies, bumpAttack);
        break;
      case 'ArrowLeft':
      case 'a': case 'A':
        action = () => {
          player.animationFrame = 1;
          return grid.move(player, -1, 0, map, turns.enemies, bumpAttack);
        };
        break;
      case 'ArrowRight':
      case 'd': case 'D':
        action = () => {
          player.animationFrame = 0;
          return grid.move(player,  1, 0, map, turns.enemies, bumpAttack);
        };
        break;
    }

    if ((event.key === 'Enter' || event.key === ' ') && waitingConfirm) {
      waitingConfirm = false;
      await advanceFloor();
      return;
    }

    if (!action) return;

    const moved = turns.playerAct(action, map, grid, player);

    if (moved) {
      if (playerLight) {
        playerLight.x = player.x + grid.tileSize / 2;
        playerLight.y = player.y + grid.tileSize / 2;
      }

      const playerPos = grid.toGrid(player.x, player.y);

      if (turns.enemies.length === 0 && stairSprite && !stairSprite.isVisible) {
        spawnStair();
        return;
      }

      checkFloorClear(playerPos.x, playerPos.y);
    }
  });
});