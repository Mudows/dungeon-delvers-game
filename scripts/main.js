import { Grid }                      from './grid.js';
import { GameMap }                   from './map.js';
import { TurnManager, EnemyFactory } from './turn.js';

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

  runtime.addEventListener('beforeprojectstart', async () => {
    OnBeforeProjectStart(runtime);

    player  = runtime.objects.player.getFirstInstance();
    tileset = runtime.objects.simpleTileset.getFirstInstance();

    // Dados do jogador (stats base — a mover para player.js futuramente)
    player.atq       = 3;
    player.def       = 1;
    player.weaponAtq = 0;
    player.hp        = 20;
    player.maxHp     = 20;

    // takeDamage do jogador (espelho do Enemy)
    player.takeDamage = (amount) => {
      player.hp = Math.max(0, player.hp - amount);
      console.log(`Jogador HP: ${player.hp}/${player.maxHp}`);
      if (player.hp === 0) console.warn('Jogador morreu!');
    };

    const enemiesData = await runtime.assets.fetchJson('enemies.json');
    const factory     = new EnemyFactory(enemiesData.families.goblins);

    map.render(tileset);

    const start = map.getPlayerStart();
    const pos   = grid.toPixel(start.x, start.y);
    player.x = pos.x;
    player.y = pos.y;

    // getEnemySpawns(2) retorna até 2 posições válidas de chão por sala
    for (const roomSpawns of map.getEnemySpawns(2)) {
      // Sorteia quantos inimigos aparecem nesta sala (1 ou 2)
      const count    = randomInt(1, 2);
      const selected = roomSpawns.slice(0, count);

      for (const pos of selected) {
        const enemy = factory.spawn(pos.x, pos.y, grid, runtime);
        turns.addEnemy(enemy);
      }
    }

    console.log(`${turns.enemies.length} inimigo(s) spawnado(s) — família: ${factory.familyName}`);
  });

  // ---------------------------------------------------------------------------
  // Input — move() agora recebe enemies e turns para o bump attack
  // ---------------------------------------------------------------------------
  runtime.addEventListener('keydown', (event) => {
    let action = null;

    switch (event.key) {
      case 'ArrowUp':
        action = () => grid.move(player, 0, -1, map, turns.enemies, turns);
        break;
      case 'ArrowDown':
        action = () => grid.move(player, 0,  1, map, turns.enemies, turns);
        break;
      case 'ArrowLeft':
        action = () => grid.move(player, -1, 0, map, turns.enemies, turns);
        break;
      case 'ArrowRight':
        action = () => grid.move(player,  1, 0, map, turns.enemies, turns);
        break;
    }

    if (action) turns.playerAct(action, map, grid, player);
  });
});

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}