import { randomInt } from './utils.js';

/**
 * combat.js — Resolução de combate físico por rolagem contestada.
 *
 * Todos os stats são lidos diretamente das instVars do sprite (família baseStats).
 * O jogador tem weaponAtq como instVar exclusiva — inimigos não têm, retorna 0.
 *
 *   attackRoll  = rand(0–10) + atq_base do atacante
 *   defenseRoll = rand(0–10) + def_base do defensor
 *
 *   Acerto  (attackRoll > defenseRoll):
 *     dano = weaponAtq + (attackRoll − defenseRoll), mínimo 1
 *   Erro    (defenseRoll ≥ attackRoll): sem dano.
 *
 * @param {IWorldInstance} attacker - sprite com instVars da família baseStats
 * @param {IWorldInstance} defender - sprite com instVars da família baseStats
 * @returns {number} dano aplicado (0 = errou)
 */
export function physicalAttack(attacker, defender) {
  const attackRoll  = randomInt(0, 10) + attacker.instVars.atq_base;
  const defenseRoll = randomInt(0, 10) + defender.instVars.def_base;

  if (attackRoll <= defenseRoll) return 0;

  const weaponAtq = attacker.instVars.weaponAtq ?? 0;
  const damage    = Math.max(1, weaponAtq + (attackRoll - defenseRoll));

  applyDamage(defender, damage);
  return damage;
}

/**
 * Aplica dano a qualquer entidade com instVars da família baseStats.
 * Centralizado aqui para garantir que hp_curr nunca fica negativo.
 *
 * @param {IWorldInstance} entity
 * @param {number}         amount
 */
export function applyDamage(entity, amount) {
  entity.instVars.hp_curr = Math.max(0, entity.instVars.hp_curr - amount);
}