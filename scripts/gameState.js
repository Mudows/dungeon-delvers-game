/**
 * gameState.js — Máquina de estados central do jogo.
 *
 * ESTADOS:
 *   EXPLORING — jogador se move livremente. Inimigos existem no mapa mas não agem.
 *   COMBAT    — turno a turno. Jogador move + age. Inimigos respondem.
 *   GAMEOVER  — jogador derrotado. Inputs e gameplay bloqueados.
 *
 * USO:
 *   import { gameState, GameStates } from './gameState.js';
 *
 *   gameState.on('enterCombat', ({ enemies }) => { ... });
 *   gameState.on('exitCombat',  ()            => { ... });
 *   gameState.on('gameOver',    ()            => { ... });
 *
 *   gameState.enterCombat(enemiesInSight);
 *   gameState.exitCombat();
 *   gameState.enterGameOver();
 *
 *   if (gameState.is(GameStates.COMBAT)) { ... }
 */

export const GameStates = Object.freeze({
  EXPLORING : 'EXPLORING',
  COMBAT    : 'COMBAT',
  GAMEOVER  : 'GAMEOVER',
});

class GameState {
  constructor() {
    this._state     = GameStates.EXPLORING;
    this._listeners = {};  // { eventName: [fn, ...] }
  }

  // ---------------------------------------------------------------------------
  // Leitura
  // ---------------------------------------------------------------------------

  get current() { return this._state; }

  is(state) { return this._state === state; }

  // ---------------------------------------------------------------------------
  // Transições
  // ---------------------------------------------------------------------------

  /**
   * Inicia um combate com a lista de inimigos envolvidos.
   * Ignora silenciosamente se já estiver em COMBAT ou GAMEOVER.
   *
   * @param {Enemy[]} enemies - inimigos que entraram em combate
   */
  enterCombat(enemies) {
    if (this._state === GameStates.COMBAT) return;
    if (this._state === GameStates.GAMEOVER) return;

    this._state = GameStates.COMBAT;

    console.log(`[GameState] → COMBAT (${enemies.length} inimigo(s))`);
    this._emit('enterCombat', { enemies });
  }

  /**
   * Encerra o combate e retorna à exploração.
   * Ignora silenciosamente se já estiver em EXPLORING.
   *
   * @param {'victory'|'flee'} reason - motivo do fim do combate
   */
  exitCombat(reason = 'victory') {
    if (this._state === GameStates.EXPLORING) return;
    if (this._state === GameStates.GAMEOVER) return;

    this._state = GameStates.EXPLORING;

    console.log(`[GameState] → EXPLORING (${reason})`);
    this._emit('exitCombat', { reason });
  }

  /**
   * Coloca o jogo em estado de derrota.
   * Bloqueia novas transições de gameplay até reinício.
   *
   * @param {string} reason
   */
  enterGameOver(reason = 'defeat') {
    if (this._state === GameStates.GAMEOVER) return;

    this._state = GameStates.GAMEOVER;

    console.log(`[GameState] → GAMEOVER (${reason})`);
    this._emit('gameOver', { reason });
  }

  /**
   * Reinicia o estado principal do jogo.
   * Utilizado pelo fluxo de restart.
   */
  reset() {
    this._state = GameStates.EXPLORING;

    console.log('[GameState] → RESET → EXPLORING');
    this._emit('reset', {});
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------

  /**
   * Registra um listener para um evento de transição de estado.
   *
   * Eventos disponíveis:
   *   'enterCombat' — { enemies: Enemy[] }
   *   'exitCombat'  — { reason: 'victory' | 'flee' }
   *   'gameOver'   — { reason: string }
   *   'reset'      — {}
   *
   * @param {string}   event
   * @param {Function} fn
   * @returns {Function} unsubscribe — chame para remover o listener
   */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(l => l !== fn);
  }

  _emit(event, payload) {
    for (const fn of (this._listeners[event] ?? [])) {
      fn(payload);
    }
  }
}

// Singleton — um único estado para todo o jogo
export const gameState = new GameState();