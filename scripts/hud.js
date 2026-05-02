/**
 * hud.js — Interface do jogador (MVP).
 *
 * Lê hp_curr e hp_max diretamente das instVars do sprite do jogador
 * (família baseStats). Não acessa propriedades JS do objeto player.
 *
 * CONFIGURAÇÃO NO EDITOR DO C3:
 * ---------------------------------------------------------------
 *   PlayerHpBarBg   : Tiled Background — fundo da barra
 *   PlayerHpBarFill : Tiled Background — preenchimento da barra
 *                     Mesma posição e altura que PlayerHpBarBg.
 *                     Largura máxima (100% HP) é lida do editor.
 *   PlayerHpText    : Text object — exibe "HP atual / HP máximo"
 * ---------------------------------------------------------------
 */
export class HUD {
  /**
   * @param {IRuntime}       runtime
   * @param {IWorldInstance} player  - sprite do jogador com instVars da família baseStats
   */
  constructor(runtime, player) {
    this.runtime = runtime;
    this.player  = player;

    this._maxBarWidth = null;
    this._bg          = null;
    this._fill        = null;
    this._text        = null;

    this._init();
  }

  _init() {
    this._bg   = this._getInstance('PlayerHpBarBg');
    this._fill = this._getInstance('PlayerHpBarFill');
    this._text = this._getInstance('PlayerHpText');

    if (this._fill) {
      this._maxBarWidth = this._fill.width;
    }

    this.update();
  }

  update() {
    const hp_curr = this.player.instVars.hp_curr;
    const hp_max  = this.player.instVars.hp_max;
    const ratio   = hp_max > 0 ? Math.max(0, hp_curr / hp_max) : 0;

    if (this._fill && this._maxBarWidth !== null) {
      this._fill.width = Math.max(0, this._maxBarWidth * ratio);
    }

    if (this._text) {
      this._text.text = `${hp_curr} / ${hp_max}`;
    }
  }

  _getInstance(name) {
    const type = this.runtime.objects[name];
    if (!type) {
      console.warn(`[HUD] Objeto "${name}" não encontrado. Verifique o nome no editor do C3.`);
      return null;
    }
    const instance = type.getFirstInstance();
    if (!instance) {
      console.warn(`[HUD] Nenhuma instância de "${name}" encontrada no layout.`);
      return null;
    }
    return instance;
  }
}