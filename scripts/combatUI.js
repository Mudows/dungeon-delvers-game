/**
 * combatUI.js — Menu de combate flutuante estilo Breath of Fire 3.
 *
 * Quatro opções posicionadas ao redor do jogador, navegadas pelas
 * setas direcionais. Enter ou Espaço confirma a seleção.
 *
 * LAYOUT (relativo ao tile do jogador):
 *   ↑  Mover   — cima
 *   →  Atacar  — direita
 *   ↓  Magia   — baixo   (placeholder MVP)
 *   ←  Defender — esquerda (placeholder MVP)
 *
 * PRÉ-REQUISITOS NO C3:
 *   - Objeto Text "CombatMenuOption" na layer UI (parallax 0,0)
 *     Será criado dinamicamente — não precisa de instância no editor.
 *   - A layer UI deve existir.
 *
 * USO:
 *   import { CombatUI, CombatActions } from './combatUI.js';
 *
 *   const ui = new CombatUI(runtime, grid);
 *
 *   ui.onSelect((action) => {
 *     if (action === CombatActions.MOVE)   { ... }
 *     if (action === CombatActions.ATTACK) { ... }
 *   });
 *
 *   ui.show(player);   // exibe menu centrado no jogador
 *   ui.hide();         // esconde menu
 *   ui.isVisible       // true/false
 */

export const CombatActions = Object.freeze({
  MOVE    : 'move',
  ATTACK  : 'attack',
  MAGIC   : 'magic',    // placeholder MVP
  DEFEND  : 'defend',   // placeholder MVP
});

// Direção → ação mapeada
const DIR_MAP = Object.freeze({
  ArrowUp    : CombatActions.MOVE,
  ArrowDown  : CombatActions.MAGIC,
  ArrowLeft  : CombatActions.DEFEND,
  ArrowRight : CombatActions.ATTACK,
});

// Configuração visual de cada opção
const OPTIONS = [
  {
    action    : CombatActions.MOVE,
    label     : '↑ Mover',
    offsetX   : 0,
    offsetY   : -2,   // tiles acima do jogador
    available : true,
  },
  {
    action    : CombatActions.ATTACK,
    label     : '→ Atacar',
    offsetX   : 2,    // tiles à direita
    offsetY   : 0,
    available : true,
  },
  {
    action    : CombatActions.MAGIC,
    label     : '↓ Magia',
    offsetX   : 0,
    offsetY   : 2,    // tiles abaixo
    available : false, // placeholder
  },
  {
    action    : CombatActions.DEFEND,
    label     : '← Defender',
    offsetX   : -2,   // tiles à esquerda
    offsetY   : 0,
    available : false, // placeholder
  },
];

export class CombatUI {
  /**
   * @param {IRuntime} runtime
   * @param {Grid}     grid
   */
  constructor(runtime, grid) {
    this.runtime   = runtime;
    this.grid      = grid;
    this._visible  = false;
    this._selected = null; // CombatActions atual selecionado
    this._labels   = [];   // instâncias Text ativas
    this._onSelect = null;

    this._handleKey = this._handleKey.bind(this);
  }

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------

  get isVisible() { return this._visible; }

  /**
   * Registra callback chamado quando jogador confirma uma ação.
   * @param {(action: string) => void} fn
   */
  onSelect(fn) { this._onSelect = fn; }

  /**
   * Exibe o menu ao redor do jogador.
   * @param {IWorldInstance} player
   */
  show(player) {
    if (this._visible) return;
    this._visible  = true;
    this._selected = CombatActions.MOVE; // padrão inicial

    this._spawnLabels(player);
    this._updateHighlight();

    this.runtime.addEventListener('keydown', this._handleKey);
  }

  /** Esconde e destrói as instâncias de texto do menu. */
  hide() {
    if (!this._visible) return;
    this._visible  = false;
    this._selected = null;

    for (const inst of this._labels) inst?.destroy();
    this._labels = [];

    this.runtime.removeEventListener('keydown', this._handleKey);
  }

  // ---------------------------------------------------------------------------
  // Criação das labels
  // ---------------------------------------------------------------------------

  _spawnLabels(player) {
    const textType = this.runtime.objects['CombatMenuOption'];
    if (!textType) {
      console.warn('[CombatUI] Objeto "CombatMenuOption" não encontrado no C3.');
      return;
    }

    const origin = this.grid.toGrid(player.x, player.y);

    for (const opt of OPTIONS) {
      const tx = origin.x + opt.offsetX;
      const ty = origin.y + opt.offsetY;
      const px = this.grid.toPixel(tx, ty);

      const inst = textType.createInstance('UI', px.x, px.y);
      inst.text     = opt.available ? opt.label : opt.label + ' –';
      inst.opacity  = opt.available ? 1 : 0.35;

      // Tag para identificar qual ação este label representa
      inst._action  = opt.action;

      this._labels.push(inst);
    }
  }

  // ---------------------------------------------------------------------------
  // Navegação e confirmação
  // ---------------------------------------------------------------------------

  _handleKey(event) {
    if (!this._visible) return;

    // Navegação — seta muda seleção
    if (DIR_MAP[event.key]) {
      const action = DIR_MAP[event.key];
      const opt    = OPTIONS.find(o => o.action === action);

      // Não seleciona placeholders
      if (opt && !opt.available) return;

      this._selected = action;
      this._updateHighlight();
      event.stopPropagation?.();
      return;
    }

    // Confirmação
    if (event.key === 'Enter' || event.key === ' ') {
      if (!this._selected) return;
      const action = this._selected;
      this.hide();
      this._onSelect?.(action);
      event.stopPropagation?.();
    }
  }

  /**
   * Atualiza a aparência visual das labels para indicar qual está selecionada.
   * Label selecionada: colorRgb branco, scale maior.
   * Labels não selecionadas: colorRgb acinzentado.
   */
  _updateHighlight() {
    for (const inst of this._labels) {
      const isSelected = inst._action === this._selected;
      inst.colorRgb = isSelected ? [1, 1, 1] : [0.55, 0.55, 0.55];
    }
  }
}