/**
 * themes.js — Temas visuais das fases.
 *
 * Cada tema define qual índice de tile do tileset corresponde a cada
 * tipo de superfície do mapa. O GameMap usa o tema para decidir qual
 * tile renderizar em cada célula — a lógica de geração não muda.
 *
 * COMO CONFIGURAR:
 * ---------------------------------------------------------------
 * Cada tipo de tile aceita uma lista de opções com peso:
 *   { index: N, weight: W }
 *
 *   index  → índice do tile no tileset do Construct 3 (linha × colunas + coluna)
 *   weight → peso relativo do sorteio. Ex: weight 70 e weight 30 = 70% e 30%
 *
 * Para usar um tile fixo sem variação, coloque apenas uma entrada na lista.
 *
 * Tipos de tile disponíveis:
 *   floor   → chão de sala (e corredor — ambos usam o mesmo pool)
 *   wall    → parede
 *
 * COMO ADICIONAR UM NOVO TEMA:
 *   1. Copie um tema existente e dê um novo nome
 *   2. Ajuste os índices conforme o tileset da fase
 *   3. Passe o nome do tema ao instanciar o GameMap no main.js:
 *      const map = new GameMap(32, 32, 6, 'catacomb');
 * ---------------------------------------------------------------
 */
export const themes = {

  // Tema padrão — Caverna (labirintos 1–3, MVP)
  cave: {
    // TILE OCULTO: índice do tile sólido preto usado fora do campo de visão.
    // Ajuste para o índice correto no seu tileset.
    hidden: 1,

    floor: [
      { index: 0, weight: 70 }, // chão principal
      { index: 2, weight: 20 }, // variação com pequena pedra
      { index: 3, weight: 10 }, // variação com rachadura
    ],
    wall: [
      { index: 1, weight: 100 }, // parede de pedra
    ],
  },

  // Tema Catacumba — labirintos 4–6 (a configurar quando o tileset estiver pronto)
  catacomb: {
    hidden: 1,
    floor: [
      { index: 0, weight: 100 },
    ],
    wall: [
      { index: 1, weight: 100 },
    ],
  },

  // Tema Inferno Congelado — labirintos 7–9 (a configurar)
  frozenHell: {
    hidden: 1,
    floor: [
      { index: 0, weight: 100 },
    ],
    wall: [
      { index: 1, weight: 100 },
    ],
  },
};

/**
 * Sorteia um índice de tile a partir de uma lista de opções ponderadas.
 * Exportado para ser usado pelo GameMap na renderização.
 *
 * @param {{ index: number, weight: number }[]} options
 * @returns {number} índice do tile sorteado
 */
export function pickTile(options) {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll    = Math.random() * total;

  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.index;
  }

  return options[options.length - 1].index;
}