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
  let defeatQuotes = [];
  let txtPressR;
  let txtGameOver;
  let gameOverLayer;
  let waitingConfirm = false;
  let combatEnemies = [];
  let defendActive = false;

  const combatUI  = new CombatUI(runtime, grid);
  const highlight = new RangeHighlight(runtime, grid);
  const queue     = new TurnQueue();

  function getWeaponRange() {
    return player.instVars.weaponAtq > 0 ? (player._weaponRange ?? 1) : 1;
  }

  function _showGameOverScreen() {
    if (gameOverLayer) {
      gameOverLayer.isVisible = true;
    }

    if (txtPressR) {
      txtPressR.isVisible = true;
      txtPressR.text = 'Pressione R para reiniciar';
    }

    if (txtGameOver) {
      txtGameOver.isVisible = true;

      if (Array.isArray(defeatQuotes) && defeatQuotes.length > 0) {
        txtGameOver.text = defeatQuotes[randomInt(0, defeatQuotes.length - 1)];
      } else {
        txtGameOver.text = 'VOCÊ MORREU';
      }
    }
  }
});