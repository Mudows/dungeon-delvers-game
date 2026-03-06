import { Grid } from './grid.js';
import { GameMap } from './map.js';

async function OnBeforeProjectStart(runtime) {
  // Code to run just before 'On start of layout' on
  // the first layout. Loading has finished and initial
  // instances are created and available to use here.

  runtime.addEventListener('tick', () => Tick(runtime));
}

function Tick(runtime) {
  // Code to run every tick
}

runOnStartup(async (runtime) => {
  const grid = new Grid(16);
	const map = new GameMap(16, 16);

  let player;

  runtime.addEventListener('beforeprojectstart', () => {
    OnBeforeProjectStart(runtime);

    player = runtime.objects.player.getFirstInstance();

    const pos = grid.toPixel(5, 5);

    player.x = pos.x;
    player.y = pos.y;

		console.warn(map.grid)
  });

	runtime.addEventListener('keydown', event => {
		switch (event.key) {
			case 'ArrowUp':
				grid.move(player, 0, -1);
				break;
			case 'ArrowDown':
				grid.move(player, 0, 1);
				break;
			case 'ArrowLeft':
				grid.move(player, -1, 0);
				break;
			case 'ArrowRight':
				grid.move(player, 1, 0);
				break;
		}
	});
});
