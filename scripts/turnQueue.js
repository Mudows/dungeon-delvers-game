/**
 * turnQueue.js — Ordem de ação dentro do modo COMBAT.
 *
 * O combate segue esta sequência por rodada:
 *   1. Jogador age (mover OU atacar)
 *   2. Cada inimigo age em ordem de inserção
 *   3. Nova rodada começa — volta ao passo 1
 *
 * O TurnQueue não executa as ações — ele controla QUEM pode agir agora
 * e notifica o main.js via callbacks quando a vez muda.
 *
 * ESTADOS INTERNOS:
 *   'player'  — aguardando input do jogador
 *   'enemies' — inimigos executando suas ações em sequência
 *   'done'    — todos os inimigos agiram, rodada encerrada
 *
 * USO:
 *   import { TurnQueue } from './turnQueue.js';
 *
 *   const queue = new TurnQueue();
 *
 *   queue.onPlayerTurn(() => {
 *     // habilita input do jogador, exibe menu
 *   });
 *
 *   queue.onEnemiesTurn((enemies) => {
 *     // executa IA de cada inimigo
 *   });
 *
 *   queue.onRoundEnd((round) => {
 *     // atualiza HUD, verifica condições de fim de combate
 *   });
 *
 *   queue.start(enemies);     // inicia o combate, dispara onPlayerTurn
 *   queue.playerDone();       // jogador terminou sua ação → vez dos inimigos
 *   queue.reset();            // limpa estado (ao sair do combate)
 */

export class TurnQueue {
  constructor() {
    this._phase   = 'idle'; // 'idle' | 'player' | 'enemies' | 'done'
    this._enemies = [];
    this._round   = 0;

    this._onPlayerTurn  = null;
    this._onEnemiesTurn = null;
    this._onRoundEnd    = null;
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  onPlayerTurn(fn)  { this._onPlayerTurn  = fn; }
  onEnemiesTurn(fn) { this._onEnemiesTurn = fn; }
  onRoundEnd(fn)    { this._onRoundEnd    = fn; }

  // ---------------------------------------------------------------------------
  // Controle de fase
  // ---------------------------------------------------------------------------

  /**
   * Inicia o combate com a lista de inimigos envolvidos.
   * Dispara onPlayerTurn imediatamente.
   *
   * @param {Enemy[]} enemies
   */
  start(enemies) {
    this._enemies = [...enemies];
    this._round   = 1;
    this._phase   = 'player';
    console.log(`[TurnQueue] Combate iniciado — rodada ${this._round}`);
    this._onPlayerTurn?.();
  }

  /**
   * Chamado pelo main.js quando o jogador terminou sua ação (moveu ou atacou).
   * Avança para a fase dos inimigos.
   */
  playerDone() {
    if (this._phase !== 'player') return;
    this._phase = 'enemies';
    console.log(`[TurnQueue] Vez dos inimigos — rodada ${this._round}`);

    // Filtra inimigos mortos que possam ter sido removidos durante o turno
    const alive = this._enemies.filter(e => !e.isDead());
    this._onEnemiesTurn?.(alive);
  }

  /**
   * Chamado pelo main.js após todos os inimigos terem agido.
   * Encerra a rodada e inicia a próxima.
   */
  enemiesDone() {
    if (this._phase !== 'enemies') return;
    this._phase = 'done';

    this._onRoundEnd?.(this._round);
    this._round++;

    // Inicia próxima rodada se ainda houver inimigos vivos
    const alive = this._enemies.filter(e => !e.isDead());
    if (alive.length > 0) {
      this._phase = 'player';
      console.log(`[TurnQueue] Rodada ${this._round} — vez do jogador`);
      this._onPlayerTurn?.();
    } else {
      console.log('[TurnQueue] Nenhum inimigo vivo — combate encerrado.');
    }
  }

  /**
   * Sincroniza a lista de inimigos ativos (ex: após um inimigo morrer).
   * Pode ser chamado a qualquer momento durante o combate.
   *
   * @param {Enemy[]} enemies
   */
  syncEnemies(enemies) {
    this._enemies = enemies.filter(e => !e.isDead());
  }

  /** Reseta o estado — chamado ao sair do modo COMBAT. */
  reset() {
    this._phase   = 'idle';
    this._enemies = [];
    this._round   = 0;
  }

  // ---------------------------------------------------------------------------
  // Leitura
  // ---------------------------------------------------------------------------

  get phase()  { return this._phase; }
  get round()  { return this._round; }

  get isPlayerTurn()  { return this._phase === 'player'; }
  get isEnemiesTurn() { return this._phase === 'enemies'; }
}