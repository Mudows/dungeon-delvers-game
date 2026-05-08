/**
 * combatUI.js — Menu de combate flutuante estilo Breath of Fire 3.
 *
 * Quatro opções posicionadas ao redor do jogador, navegadas pelas
 * setas direcionais. Enter ou Espaço confirma a seleção.
 */

export const CombatActions = Object.freeze({
  MOVE    : 'move',
  ATTACK  : 'attack',
  MAGIC   : 'magic',
  DEFEND  : 'defend',
});

const DIR_MAP = Object.freeze({
  ArrowUp    : CombatActions.MOVE,
  ArrowDown  : CombatActions.MAGIC,
  ArrowLeft  : CombatActions.DEFEND,
  ArrowRight : CombatActions.ATTACK,
});

const OPTIONS = [
  { action: CombatActions.MOVE,   label: '↑ Mover',    offsetX:  0, offsetY: -2, available: true  },
  { action: CombatActions.ATTACK, label: '→ Atacar',   offsetX:  2, offsetY:  0, available: true  },
  { action: CombatActions.MAGIC,  label: '↓ Magia',    offsetX:  0, offsetY:  2, available: false },
  { action: CombatActions.DEFEND, label: '← Defender', offsetX: -2, offsetY:  0, available: false },
];

export class CombatUI {
  constructor(runtime, grid) {
    this.runtime   = runtime;
    this.grid      = grid;
    this._visible  = false;
    this._selected = null;
    this._labels   = [];
    this._onSelect = null;
  }

  get isVisible() { return this._visible; }
  onSelect(fn) { this._onSelect = fn; }

  show(player) {
    if (this._visible) return;
    this._visible  = true;
    this._selected = CombatActions.MOVE;
    this._spawnLabels(player);
    this._updateHighlight();
  }

  hide() {
    if (!this._visible) return;
    this._visible  = false;
    this._selected = null;

    for (const inst of this._labels) inst?.destroy();
    this._labels = [];
  }

  _spawnLabels(player) {
    // Nome real do objeto no Construct 3: objectTypes/UI/combatMenuOption.json.
    // Mantém fallback para projetos antigos que tenham sido renomeados com C maiúsculo.
    const textType = this.runtime.objects['combatMenuOption'] ?? this.runtime.objects['CombatMenuOption'];
    if (!textType) {
      console.warn('[CombatUI] Objeto "combatMenuOption" não encontrado no C3.');
      return;
    }

    const origin = this.grid.toGrid(player.x, player.y);

    for (const opt of OPTIONS) {
      const tx = origin.x + opt.offsetX;
      const ty = origin.y + opt.offsetY;
      const px = this.grid.toPixel(tx, ty);

      const inst = textType.createInstance('UI', px.x, px.y);
      inst.text    = opt.available ? opt.label : opt.label + ' –';
      inst.opacity = opt.available ? 1 : 0.35;
      inst._action = opt.action;

      this._labels.push(inst);
    }
  }

  handleInput(event) {
    if (!this._visible) return false;

    if (DIR_MAP[event.key]) {
      const action = DIR_MAP[event.key];
      const opt = OPTIONS.find(o => o.action === action);
      if (opt && !opt.available) return false;

      this._selected = action;
      this._updateHighlight();
      return true;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (!this._selected) return false;
      const action = this._selected;
      this.hide();
      this._onSelect?.(action);
      return true;
    }

    return false;
  }

  _updateHighlight() {
    for (const inst of this._labels) {
      const isSelected = inst._action === this._selected;
      inst.colorRgb = isSelected ? [1, 1, 1] : [0.55, 0.55, 0.55];
    }
  }
}