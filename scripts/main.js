import { Grid } from './grid.js';
import { GameMap } from './map.js';

async function OnBeforeProjectStart(runtime) {
  runtime.addEventListener('tick', () => Tick(runtime));
}

function Tick(runtime) {
  // Lógica por tick (a ser expandida com sistema de turnos)
}

runOnStartup(async (runtime) => {
  // MVP nível 1: mapa 32×32, até 6 salas
  const grid = new Grid(16);
  const map  = new GameMap(32, 32, 6);

  let player;
  let tileset;

  runtime.addEventListener('beforeprojectstart', () => {
    OnBeforeProjectStart(runtime);

    player  = runtime.objects.player.getFirstInstance();
    tileset = runtime.objects.simpleTileset.getFirstInstance();

    // Renderiza o mapa no tilemap
    map.render(tileset);

    // Posiciona o jogador no centro da primeira sala
    const start = map.getPlayerStart();
    const pos   = grid.toPixel(start.x, start.y);
    player.x = pos.x;
    player.y = pos.y;

    // Debug: exibe salas e spawns de inimigos no console
    console.log('Salas geradas:', map.rooms);
    console.log('Spawns de inimigos:', map.getEnemySpawns());
  });

  runtime.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowUp':
        grid.move(player, 0, -1, map);
        break;
      case 'ArrowDown':
        grid.move(player, 0, 1, map);
        break;
      case 'ArrowLeft':
        grid.move(player, -1, 0, map);
        break;
      case 'ArrowRight':
        grid.move(player, 1, 0, map);
        break;
    }
  });
});