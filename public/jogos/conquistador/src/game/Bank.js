import { GAME_CONFIG } from '../data/gameConfig.js';
import { RESOURCE_IDS } from '../data/resources.js';

export class Bank {
  constructor(cardsPerResource = GAME_CONFIG.bankCardsPerResource) {
    if (!Number.isInteger(cardsPerResource) || cardsPerResource < 0) {
      throw new Error('A quantidade inicial da Reserva deve ser um inteiro não negativo.');
    }
    this.inventory = Object.fromEntries(
      RESOURCE_IDS.map((resourceId) => [resourceId, cardsPerResource]),
    );
  }

  get(resourceId) {
    this.#assertResource(resourceId);
    return this.inventory[resourceId];
  }

  deposit(resourceId, quantity) {
    this.#assertQuantity(quantity);
    this.#assertResource(resourceId);
    this.inventory[resourceId] += quantity;
  }

  withdraw(resourceId, quantity) {
    this.#assertQuantity(quantity);
    this.#assertResource(resourceId);
    if (this.inventory[resourceId] < quantity) return false;
    this.inventory[resourceId] -= quantity;
    return true;
  }

  distributeProduction(claims) {
    const granted = [];
    const deniedResources = [];
    const grouped = new Map();

    for (const claim of claims) {
      const { playerId, resourceId, quantity } = claim;
      this.#assertResource(resourceId);
      this.#assertQuantity(quantity);
      if (!playerId) throw new Error('Cada pedido de produção requer playerId.');
      if (!grouped.has(resourceId)) grouped.set(resourceId, []);
      grouped.get(resourceId).push({ playerId, resourceId, quantity });
    }

    for (const [resourceId, resourceClaims] of grouped.entries()) {
      const required = resourceClaims.reduce((total, claim) => total + claim.quantity, 0);
      if (this.inventory[resourceId] < required) {
        deniedResources.push(resourceId);
        continue;
      }
      this.inventory[resourceId] -= required;
      granted.push(...resourceClaims);
    }

    return { granted, deniedResources };
  }

  snapshot() {
    return { ...this.inventory };
  }

  #assertResource(resourceId) {
    if (!RESOURCE_IDS.includes(resourceId)) {
      throw new Error(`Recurso inválido na Reserva: ${resourceId}`);
    }
  }

  #assertQuantity(quantity) {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Quantidade inválida: ${quantity}`);
    }
  }
}
