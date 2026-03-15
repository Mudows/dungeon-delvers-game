import { Grid }                      from './grid.js';
import { GameMap }                   from './map.js';
import { TurnManager, EnemyFactory } from './turn.js';
import { HUD }                       from './hud.js';

async function OnBeforeProjectStart(runtime) {
  runtime.addEventListener('tick', () => Tick(runtime));
}

function Tick(runtime) {
  // Animações, UI, etc.
}

runOnStartup(async (runtime) => {
  const grid  = new Grid(16);
  const map   = new GameMap(32, 32, 6);
  const turns = new TurnManager();

  turns.onTurnStart((n) => console.log(`--- Turno ${n} ---`));

  let player;
  let tileset;
  let hud;

  runtime.addEventListener('beforeprojectstart', async () => {
    try {
      OnBeforeProjectStart(runtime);

      player  = runtime.objects.player.getFirstInstance();
      tileset = runtime.objects.simpleTileset.getFirstInstance();
      console.log('✔ Objetos obtidos');

      // Stats lidos das instVars do objeto player no editor do C3
      // Configure as seguintes instVars no objeto: atq, def, weaponAtq, hp, maxHp
      player.atq       = player.instVars.atq;
      player.def       = player.instVars.def;
      player.weaponAtq = player.instVars.weaponAtq;
      player.hp        = player.instVars.hp;
      player.maxHp     = player.instVars.maxHp;

      player.takeDamage = (amount) => {
        player.hp = Math.max(0, player.hp - amount);
        // Mantém instVar sincronizada com o valor em runtime
        player.instVars.hp = player.hp;
        hud?.update();
        console.log(`Jogador HP: ${player.hp}/${player.maxHp}`);
        if (player.hp === 0) console.warn('Jogador morreu!');
      };

      // Carrega JSON
      const enemiesData = await runtime.assets.fetchJson('enemies.json');
      console.log('✔ JSON carregado');
      const factory = new EnemyFactory(enemiesData.families.goblins);

      // Renderiza mapa
      map.render(tileset);
      console.log('✔ Mapa renderizado');

      // Posiciona jogador
      const start = map.getPlayerStart();
      const pos   = grid.toPixel(start.x, start.y);
      player.x = pos.x;
      player.y = pos.y;
      console.log(`✔ Jogador em (${start.x}, ${start.y})`);

      // Spawna inimigos
      for (const roomSpawns of map.getEnemySpawns(2)) {
        const count    = randomInt(1, 2);
        const selected = roomSpawns.slice(0, count);
        for (const sp of selected) {
          const enemy = factory.spawn(sp.x, sp.y, grid, runtime);
          turns.addEnemy(enemy);
        }
      }
      console.log(`✔ ${turns.enemies.length} inimigo(s) spawnado(s)`);

      // HUD — inicializado por último, depois que tudo está pronto
      // HUD busca as instâncias já posicionadas no editor — não cria objetos novos
      hud = new HUD(runtime, player);
      console.log('✔ HUD inicializado');

    } catch (err) {
      console.error('ERRO em beforeprojectstart:', err);
    }
  });

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  runtime.addEventListener('keydown', (event) => {
    let action = null;

    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        action = () => grid.move(player, 0, -1, map, turns.enemies, turns);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        action = () => grid.move(player, 0,  1, map, turns.enemies, turns);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        action = () => {
          player.animationFrame = 1;
          grid.move(player, -1, 0, map, turns.enemies, turns);
        };
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        action = () => {
          player.animationFrame = 0;
          grid.move(player,  1, 0, map, turns.enemies, turns);
        };
        break;
    }

    if (action) turns.playerAct(action, map, grid, player);
  });
});

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}