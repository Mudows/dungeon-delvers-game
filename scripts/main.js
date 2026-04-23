import { Grid }                      from './grid.js';
import { GameMap }                   from './map.js';
import { TurnManager, EnemyFactory } from './turn.js';
import { HUD }                       from './hud.js';
import { initDebug }                  from './debug.js'; // remover em produção

// ---------------------------------------------------------------------------
// Estado global do jogo
// ---------------------------------------------------------------------------

const FLOOR_THEMES = ['cave', 'cave', 'cave']; // andares 1, 2, 3
const FLOOR_ROOMS  = [6, 8, 10];               // salas por andar (MSAT)
const FLOOR_ENEMY_FAMILY = ['goblins', 'goblins', 'goblins']; // a expandir

let currentFloor = 0; // índice do andar atual (0 = andar 1)

async function OnBeforeProjectStart(runtime) {
  runtime.addEventListener('tick', () => Tick(runtime));
}

function Tick(runtime) {
  // Animações, UI, etc.
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
  let waitingConfirm = false; // true quando jogador está sobre a escada
  let hud;
  let enemiesData;

  // ---------------------------------------------------------------------------
  // Inicializa um andar completo
  // ---------------------------------------------------------------------------
  async function loadFloor(floorIndex) {
    // Limpa turno anterior se existir
    if (turns) turns.enemies = [];

    const theme    = FLOOR_THEMES[floorIndex]  ?? 'cave';
    const maxRooms = FLOOR_ROOMS[floorIndex]   ?? 6;
    const family   = FLOOR_ENEMY_FAMILY[floorIndex] ?? 'goblins';

    map   = new GameMap(32, 32, maxRooms, theme);
    turns = new TurnManager();
    turns.onTurnStart((n) => console.log(`--- Andar ${floorIndex + 1} | Turno ${n} ---`));

    const factory = new EnemyFactory(enemiesData.families[family]);

    // Renderiza o mapa completo — névoa feita pela layer Darkness no C3
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
        turns.addEnemy(enemy);
      }
    }
    console.log(`✔ Andar ${floorIndex + 1} | ${turns.enemies.length} inimigo(s) | tema: ${theme}`);

    // Escada — aparece na sala mais distante do jogador após todos inimigos morrerem
    // O sprite "Stair" deve existir no projeto C3
    if (stairSprite) stairSprite.isVisible = false;
  }

  // ---------------------------------------------------------------------------
  // Verifica se o jogador pode avançar de andar
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

    // Busca tile de chão válido a exatamente 2 tiles do jogador
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

  /**
   * Retorna o primeiro tile de chão encontrado a exatamente `distance` tiles
   * do ponto (px, py), varrendo em espiral (N, S, L, O e diagonais).
   * Se não encontrar na distância exata, expande até distance + 2.
   */
  function findFloorNearPlayer(px, py, distance) {
    for (let d = distance; d <= distance + 2; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue; // só borda
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
      // TODO: tela de vitória
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
      stairSprite = runtime.objects.Stair?.getFirstInstance() ?? null;
      playerLight = runtime.objects.player_light?.getFirstInstance() ?? null;
      darkness    = runtime.layout.getLayer('Darkness');

      if (!stairSprite) {
        console.warn('[main] Objeto "Stair" não encontrado — progressão de andar desativada.');
      }
      if (!playerLight) {
        console.warn('[main] Objeto "player_light" não encontrado — luz do jogador desativada.');
      }

      // Stats lidos das instVars do objeto player no editor do C3
      // Configure as seguintes instVars no objeto: atq, def, weaponAtq, hp, maxHp
      player.atq       = player.instVars.atq;
      player.def       = player.instVars.def;
      player.weaponAtq = player.instVars.weaponAtq;
      player.hp        = player.instVars.hp;
      player.maxHp     = player.instVars.maxHp;

      player.takeDamage = (amount) => {
        player.hp = Math.max(0, player.hp - amount);
        player.instVars.hp = player.hp;
        hud?.update();
        console.log(`Jogador HP: ${player.hp}/${player.maxHp}`);
        if (player.hp === 0) console.warn('Jogador morreu!');
      };

      enemiesData = await runtime.assets.fetchJson('enemies.json');
      console.log('✔ JSON carregado');

      await loadFloor(currentFloor);

      // HUD busca instâncias já posicionadas no editor — não cria objetos novos
      hud = new HUD(runtime, player);

      // Debug — remover import e linha abaixo em produção
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

    switch (event.key) {
      case 'ArrowUp':
      case 'w': case 'W':
        action = () => grid.move(player, 0, -1, map, turns.enemies, turns);
        break;
      case 'ArrowDown':
      case 's': case 'S':
        action = () => grid.move(player, 0,  1, map, turns.enemies, turns);
        break;
      case 'ArrowLeft':
      case 'a': case 'A':
        action = () => {
          player.animationFrame = 1;
          return grid.move(player, -1, 0, map, turns.enemies, turns);
        };
        break;
      case 'ArrowRight':
      case 'd': case 'D':
        action = () => {
          player.animationFrame = 0;
          return grid.move(player,  1, 0, map, turns.enemies, turns);
        };
        break;
    }

    // Confirmação de descida — Enter ou Espaço quando sobre a escada
    if ((event.key === 'Enter' || event.key === ' ') && waitingConfirm) {
      waitingConfirm = false;
      await advanceFloor();
      return;
    }

    if (!action) return;

    const moved = turns.playerAct(action, map, grid, player);

    if (moved) {
      // Sincroniza o sprite de luz com o centro do jogador
      if (playerLight) {
        playerLight.x = player.x + grid.tileSize / 2;
        playerLight.y = player.y + grid.tileSize / 2;
      }

      const playerPos = grid.toGrid(player.x, player.y);

      // Revela escada quando último inimigo morre
      if (turns.enemies.length === 0 && stairSprite && !stairSprite.isVisible) {
        spawnStair();
        return; // não verifica escada no mesmo turno que ela aparece
      }

      // Verifica se jogador pisou na escada
      checkFloorClear(playerPos.x, playerPos.y);
    }
  });
});

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}