/**
 * progression.js — Sistema de progressão do jogador entre andares.
 *
 * Ao limpar um andar, apresenta 4 opções de upgrade geradas aleatoriamente.
 * Cada opção é um par único de atributos [A, B], sem repetição de pares
 * entre as 4 opções exibidas.
 *
 * Atributos de cálculo (+1): atq_base, mag_base, def_base, res_base
 * Atributos de recurso (+10): hp_max, mana_max
 *
 * Nos andares 3, 6 e 9 (índice 2, 5, 8), o efeito é dobrado.
 * Ao aumentar hp_max ou mana_max, hp_curr / mana_curr sobem junto.
 *
 * INTEGRAÇÃO COM main.js:
 *   1. Instancie ProgressionSystem uma vez, passando o runtime.
 *   2. Em _endCombat('victory'), antes de spawnStair(), chame:
 *        await progression.show(player, currentFloor);
 *   3. Após a promessa resolver, chame spawnStair() normalmente.
 *
 * PRÉ-REQUISITOS NO C3:
 *   - Objeto "ProgressionOverlay" : Sprite/Tiled BG cobrindo a tela inteira
 *     (semitransparente escuro), na layer UI.
 *   - Objetos "ProgressionBtn0" a "ProgressionBtn3" : Sprites clicáveis
 *     representando cada opção. Devem ter instVar "text" ou ser controlados
 *     via objeto Text associado (veja _renderOption).
 *   - Objetos "ProgressionLabel0" a "ProgressionLabel3" : Text objects
 *     exibindo o texto de cada opção.
 *   - Objeto "ProgressionTitle" : Text object com o título da tela.
 *
 * Todos os objetos devem estar na layer UI com parallax 0,0.
 */

// ---------------------------------------------------------------------------
// Definição do pool de atributos
// ---------------------------------------------------------------------------

/** Atributos de cálculo — bônus base +1 (dobra nos andares especiais) */
const CALC_ATTRS = [
  { key: 'atq_base',  label: 'ATQ',  type: 'calc' },
  { key: 'mag_base',  label: 'MAG',  type: 'calc' },
  { key: 'def_base',  label: 'DEF',  type: 'calc' },
  { key: 'res_base',  label: 'RES',  type: 'calc' },
];

/** Atributos de recurso — bônus base +10 (dobra nos andares especiais) */
const RESOURCE_ATTRS = [
  { key: 'hp_max',   label: 'Vida',  type: 'resource', currKey: 'hp_curr'   },
  { key: 'mana_max', label: 'Mana',  type: 'resource', currKey: 'mana_curr' },
];

const ALL_ATTRS = [...CALC_ATTRS, ...RESOURCE_ATTRS];

/** Andares (índice base-0) que dobram o efeito: andares 3, 6 e 9 */
const DOUBLE_FLOORS = new Set([2, 5, 8]);

// ---------------------------------------------------------------------------
// ProgressionSystem
// ---------------------------------------------------------------------------

export class ProgressionSystem {
  /**
   * @param {IRuntime} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
  }

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------

  /**
   * Exibe a tela de progressão e aguarda a escolha do jogador.
   * Retorna uma Promise que resolve após o upgrade ser aplicado.
   *
   * @param {IWorldInstance} player       - sprite do jogador (instVars da família baseStats)
   * @param {number}         floorIndex   - índice do andar concluído (base-0)
   * @returns {Promise<void>}
   */
  show(player, floorIndex) {
    return new Promise((resolve) => {
      const double  = DOUBLE_FLOORS.has(floorIndex);
      const options = this._generateOptions(4);

      this._showUI(options, double);
      this._awaitChoice(options, double, player, resolve);
    });
  }

  // ---------------------------------------------------------------------------
  // Geração de opções
  // ---------------------------------------------------------------------------

  /**
   * Gera `count` pares únicos de atributos, sem repetição de atributo
   * dentro do par e sem repetição de pares entre as opções.
   *
   * Algoritmo:
   *   1. Monta todos os pares possíveis de ALL_ATTRS (combinações C(n,2)).
   *   2. Embaralha.
   *   3. Retorna os primeiros `count`.
   *
   * @param {number} count
   * @returns {{ a: object, b: object }[]}
   */
  _generateOptions(count) {
    const pairs = [];

    for (let i = 0; i < ALL_ATTRS.length; i++) {
      for (let j = i + 1; j < ALL_ATTRS.length; j++) {
        pairs.push({ a: ALL_ATTRS[i], b: ALL_ATTRS[j] });
      }
    }

    _shuffle(pairs);
    return pairs.slice(0, count);
  }

  // ---------------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------------

  /**
   * Exibe o overlay e os botões com os textos das opções.
   *
   * @param {{ a: object, b: object }[]} options
   * @param {boolean}                    double
   */
  _showUI(options, double) {
    const overlay = this._get('ProgressionOverlay');
    if (overlay) overlay.isVisible = true;

    const title = this._get('ProgressionTitle');
    if (title) {
      title.text    = double ? '✦ Upgrade (DOBRADO) ✦' : '✦ Escolha um Upgrade ✦';
      title.isVisible = true;
    }

    options.forEach((pair, i) => {
      const btn   = this._get(`ProgressionBtn${i}`);
      const label = this._get(`ProgressionLabel${i}`);

      if (btn)   btn.isVisible   = true;
      if (label) {
        label.text      = _pairLabel(pair, double);
        label.isVisible = true;
      }
    });
  }

  /** Esconde todos os elementos da tela de progressão. */
  _hideUI() {
    const overlay = this._get('ProgressionOverlay');
    if (overlay) overlay.isVisible = false;

    const title = this._get('ProgressionTitle');
    if (title) title.isVisible = false;

    for (let i = 0; i < 4; i++) {
      const btn   = this._get(`ProgressionBtn${i}`);
      const label = this._get(`ProgressionLabel${i}`);
      if (btn)   btn.isVisible   = false;
      if (label) label.isVisible = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Aguarda escolha via clique nos botões
  // ---------------------------------------------------------------------------

  /**
   * Registra listeners de clique em cada botão.
   * Ao clicar, aplica o upgrade, esconde a UI e resolve a promise.
   *
   * @param {{ a: object, b: object }[]} options
   * @param {boolean}                    double
   * @param {IWorldInstance}             player
   * @param {Function}                   resolve
   */
  _awaitChoice(options, double, player, resolve) {
    const handlers = [];

    options.forEach((pair, i) => {
      const btn = this._get(`ProgressionBtn${i}`);
      if (!btn) return;

      const handler = () => {
        // Remove todos os listeners antes de aplicar
        handlers.forEach(({ btn: b, fn }) => b.removeEventListener('click', fn));

        this._applyUpgrade(player, pair, double);
        this._hideUI();

        console.log(`[Progression] Upgrade escolhido: ${_pairLabel(pair, double)}`);
        resolve();
      };

      btn.addEventListener('click', handler);
      handlers.push({ btn, fn: handler });
    });
  }

  // ---------------------------------------------------------------------------
  // Aplicação do upgrade
  // ---------------------------------------------------------------------------

  /**
   * Aplica o bônus de ambos os atributos do par nas instVars do jogador.
   *
   * @param {IWorldInstance}       player
   * @param {{ a: object, b: object }} pair
   * @param {boolean}              double
   */
  _applyUpgrade(player, pair, double) {
    [pair.a, pair.b].forEach(attr => {
      const bonus = _bonus(attr, double);
      player.instVars[attr.key] += bonus;

      // Recurso: sobe também o valor atual, sem ultrapassar o novo máximo
      if (attr.type === 'resource' && attr.currKey) {
        player.instVars[attr.currKey] = Math.min(
          player.instVars[attr.currKey] + bonus,
          player.instVars[attr.key]
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Busca a primeira instância de um objeto C3 pelo nome.
   * Retorna null com aviso se não encontrado.
   *
   * @param {string} name
   * @returns {IWorldInstance|null}
   */
  _get(name) {
    const type = this.runtime.objects[name];
    if (!type) {
      console.warn(`[Progression] Objeto "${name}" não encontrado no C3.`);
      return null;
    }
    return type.getFirstInstance() ?? null;
  }
}

// ---------------------------------------------------------------------------
// Funções auxiliares (módulo-privadas)
// ---------------------------------------------------------------------------

/**
 * Embaralha um array in-place (Fisher-Yates).
 * @param {any[]} arr
 */
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Retorna o bônus numérico de um atributo, considerando se é dobrado.
 *
 * @param {{ type: string }} attr
 * @param {boolean}          double
 * @returns {number}
 */
function _bonus(attr, double) {
  const base = attr.type === 'calc' ? 1 : 10;
  return double ? base * 2 : base;
}

/**
 * Retorna o texto legível de um par de atributos para exibir no botão.
 * Exemplo: "+1 ATQ  /  +10 Vida"  ou  "+2 ATQ  /  +20 Vida" (dobrado)
 *
 * @param {{ a: object, b: object }} pair
 * @param {boolean}                  double
 * @returns {string}
 */
function _pairLabel(pair, double) {
  const fmt = attr => `+${_bonus(attr, double)} ${attr.label}`;
  return `${fmt(pair.a)}  /  ${fmt(pair.b)}`;
}