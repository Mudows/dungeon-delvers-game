import { randomInt } from './utils.js';

/**
 * Resolução de combate físico por rolagem contestada.
 *
 *   attackRoll  = rand(0–10) + ATQ do atacante
 *   defenseRoll = rand(0–10) + DEF do defensor
 *
 *   Acerto  (attackRoll > defenseRoll): dano = ATQ_arma + (attackRoll − defenseRoll)
 *   Erro   (defenseRoll ≥ attackRoll): sem dano.
 *
 * @param {{ atq: number, weaponAtq?: number }} attacker
 * @param {{ def: number, takeDamage: Function }} defender
 * @returns {number} dano aplicado (0 = errou)
 */
export function physicalAttack(attacker, defender) {
  const attackRoll  = randomInt(0, 10) + attacker.atq;
  const defenseRoll = randomInt(0, 10) + (defender.def ?? 0);

  if (attackRoll <= defenseRoll) return 0;

  const damage = (attacker.weaponAtq ?? 0) + (attackRoll - defenseRoll);
  defender.takeDamage(damage);
  return damage;
}
