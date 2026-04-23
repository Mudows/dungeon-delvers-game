/**
 * debug.js — Ferramentas de desenvolvimento.
 *
 * COMO USAR:
 *   Importe no main.js e chame initDebug() passando as dependências:
 *     import { initDebug } from './debug.js';
 *     initDebug(runtime, { darkness, playerLight });
 *
 * COMO REMOVER:
 *   1. Apague este arquivo
 *   2. Remova o import e a chamada initDebug() do main.js
 *   Nenhuma outra parte do código será afetada.
 *
 * ATALHOS DISPONÍVEIS:
 *   1 → Liga/desliga a Fog of War (layer Darkness + player_light)
 */
export function initDebug(runtime, refs = {}) {
  const state = {
    fowEnabled: true,
  };

  runtime.addEventListener('keydown', (event) => {
    switch (event.key) {
      case '1':
        toggleFoW(state, refs);
        break;
    }
  });

  console.log('[DEBUG] Sistema de debug ativo. Atalhos: 1 = toggle FoW');
}

// ---------------------------------------------------------------------------
// Toggles
// ---------------------------------------------------------------------------

/**
 * Liga/desliga a Fog of War alternando a visibilidade
 * da layer Darkness e do sprite player_light.
 */
function toggleFoW(state, { darkness, playerLight }) {
  state.fowEnabled = !state.fowEnabled;

  if (darkness)    darkness.isVisible    = state.fowEnabled;
  if (playerLight) playerLight.isVisible = state.fowEnabled;

  console.log(`[DEBUG] FoW: ${state.fowEnabled ? 'ON' : 'OFF'}`);
}