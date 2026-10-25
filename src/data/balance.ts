export const BALANCE = {
  maxHp: 60, startElements: 5, draw: 3, capacity: 12,
  victoryHeal: 15, maxSlots: 5, spellsPerTurn: 2,
  manaMax: 100, castMana: 10, overflowMana: 15, zeroDamage: 30,
  wetDuration: 1, acidDuration: 2, dotTicks: 2,
  water: { damage: 13 }, salt: { damage: 11, pierce: 5, wetBonus: 4 },
  carbon: { shield: 12, fireReduction: 5 }, iron: { shield: 16 },
  oxygen: { boost: 10 }, acid: { damage: 7, reduction: 3 },
  peroxide: { damage: 8, dot: 4 }, graphite: { shield: 10, reflect: 3 },
  hydrogen: { damage: 7, shieldDamage: 4 }, alkali: { damage: 9, shieldDamage: 5 }, ferrous: { damage: 16, reduction: 3 },
  neutralization: { damage: 8, shield: 6 },
  methane: { damage: 20 }, ironOxide: { damage: 14 },
} as const;
