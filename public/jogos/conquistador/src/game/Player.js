import {
  RESOURCE_IDS,
} from '../data/resources.js';

const DEFAULT_PIECES =
  Object.freeze({
    segments: 15,
    villages: 5,
    cities: 4,
    tradingPosts: 1,
    monuments: 1,
  });

function createEmptyResources() {
  return Object.fromEntries(
    RESOURCE_IDS.map(
      (resourceId) => [
        resourceId,
        0,
      ],
    ),
  );
}

function normalizeInteger(
  value,
  fallback = 0,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.floor(number),
  );
}

export class Player {
  constructor({
    id,
    name,
    houseId,
    color,
    symbol,
    resources,
    pieces,
    prestige = 0,
    usedGuardCaptains = 0,
    contractPrestige = 0,
    hasLargestNetwork = false,
    hasLargestMilitary = false,
  }) {
    if (!id) {
      throw new Error(
        'O jogador precisa de um identificador.',
      );
    }

    if (!name?.trim()) {
      throw new Error(
        'O jogador precisa de um nome.',
      );
    }

    this.id =
      String(id);

    this.name =
      String(name).trim();

    this.houseId =
      houseId
        ? String(houseId)
        : null;

    this.color =
      color || '#1D4ED8';

    this.symbol =
      symbol || '◆';

    this.resources = {
      ...createEmptyResources(),
      ...(resources || {}),
    };

    this.pieces = {
      ...DEFAULT_PIECES,
      ...(pieces || {}),
    };

    this.prestige =
      normalizeInteger(
        prestige,
      );

    this.usedGuardCaptains =
      normalizeInteger(
        usedGuardCaptains,
      );

    this.contractPrestige =
      normalizeInteger(
        contractPrestige,
      );

    this.hasLargestNetwork =
      Boolean(
        hasLargestNetwork,
      );

    this.hasLargestMilitary =
      Boolean(
        hasLargestMilitary,
      );

    this.normalize();
  }

  normalize() {
    for (
      const resourceId
      of RESOURCE_IDS
    ) {
      this.resources[
        resourceId
      ] =
        normalizeInteger(
          this.resources[
            resourceId
          ],
        );
    }

    for (
      const pieceId
      of Object.keys(
        DEFAULT_PIECES,
      )
    ) {
      this.pieces[
        pieceId
      ] =
        normalizeInteger(
          this.pieces[
            pieceId
          ],
          DEFAULT_PIECES[
            pieceId
          ],
        );
    }

    this.prestige =
      normalizeInteger(
        this.prestige,
      );

    this.usedGuardCaptains =
      normalizeInteger(
        this.usedGuardCaptains,
      );

    this.contractPrestige =
      normalizeInteger(
        this.contractPrestige,
      );
  }

  getResource(
    resourceId,
  ) {
    this.assertResource(
      resourceId,
    );

    return this.resources[
      resourceId
    ];
  }

  getTotalResources() {
    return RESOURCE_IDS.reduce(
      (
        total,
        resourceId,
      ) =>
        total +
        this.resources[
          resourceId
        ],
      0,
    );
  }

  addResource(
    resourceId,
    quantity = 1,
  ) {
    this.assertResource(
      resourceId,
    );

    this.assertQuantity(
      quantity,
    );

    this.resources[
      resourceId
    ] += quantity;

    return this.resources[
      resourceId
    ];
  }

  addResources(
    resources,
  ) {
    for (
      const [
        resourceId,
        quantity,
      ]
      of Object.entries(
        resources || {},
      )
    ) {
      this.addResource(
        resourceId,
        quantity,
      );
    }

    return this.getResourcesSnapshot();
  }

  canAfford(
    cost,
  ) {
    return Object.entries(
      cost || {},
    ).every(
      ([
        resourceId,
        quantity,
      ]) => {
        this.assertResource(
          resourceId,
        );

        this.assertQuantity(
          quantity,
        );

        return (
          this.resources[
            resourceId
          ] >= quantity
        );
      },
    );
  }

  pay(
    cost,
  ) {
    if (
      !this.canAfford(
        cost,
      )
    ) {
      return false;
    }

    for (
      const [
        resourceId,
        quantity,
      ]
      of Object.entries(
        cost || {},
      )
    ) {
      this.resources[
        resourceId
      ] -= quantity;
    }

    return true;
  }

  removeResource(
    resourceId,
    quantity = 1,
  ) {
    this.assertResource(
      resourceId,
    );

    this.assertQuantity(
      quantity,
    );

    if (
      this.resources[
        resourceId
      ] < quantity
    ) {
      return false;
    }

    this.resources[
      resourceId
    ] -= quantity;

    return true;
  }

  hasPiece(
    pieceId,
    quantity = 1,
  ) {
    this.assertPiece(
      pieceId,
    );

    this.assertQuantity(
      quantity,
    );

    return (
      this.pieces[
        pieceId
      ] >= quantity
    );
  }

  usePiece(
    pieceId,
    quantity = 1,
  ) {
    if (
      !this.hasPiece(
        pieceId,
        quantity,
      )
    ) {
      return false;
    }

    this.pieces[
      pieceId
    ] -= quantity;

    return true;
  }

  returnPiece(
    pieceId,
    quantity = 1,
  ) {
    this.assertPiece(
      pieceId,
    );

    this.assertQuantity(
      quantity,
    );

    this.pieces[
      pieceId
    ] += quantity;

    return this.pieces[
      pieceId
    ];
  }

  addPrestige(
    quantity = 1,
  ) {
    this.assertQuantity(
      quantity,
    );

    this.prestige +=
      quantity;

    return this.prestige;
  }

  removePrestige(
    quantity = 1,
  ) {
    this.assertQuantity(
      quantity,
    );

    this.prestige =
      Math.max(
        0,
        this.prestige -
          quantity,
      );

    return this.prestige;
  }

  getPublicSnapshot() {
    return {
      id: this.id,
      name: this.name,
      houseId:
        this.houseId,
      color:
        this.color,
      symbol:
        this.symbol,
      prestige:
        this.prestige,
      totalResources:
        this.getTotalResources(),
      pieces: {
        ...this.pieces,
      },
      usedGuardCaptains:
        this.usedGuardCaptains,
      contractPrestige:
        this.contractPrestige,
      hasLargestNetwork:
        this.hasLargestNetwork,
      hasLargestMilitary:
        this.hasLargestMilitary,
    };
  }

  getResourcesSnapshot() {
    return {
      ...this.resources,
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      houseId:
        this.houseId,
      color:
        this.color,
      symbol:
        this.symbol,
      resources: {
        ...this.resources,
      },
      pieces: {
        ...this.pieces,
      },
      prestige:
        this.prestige,
      usedGuardCaptains:
        this.usedGuardCaptains,
      contractPrestige:
        this.contractPrestige,
      hasLargestNetwork:
        this.hasLargestNetwork,
      hasLargestMilitary:
        this.hasLargestMilitary,
    };
  }

  static fromJSON(
    data,
  ) {
    return new Player(
      data,
    );
  }

  assertResource(
    resourceId,
  ) {
    if (
      !RESOURCE_IDS.includes(
        resourceId,
      )
    ) {
      throw new Error(
        `Recurso inválido: ${resourceId}`,
      );
    }
  }

  assertPiece(
    pieceId,
  ) {
    if (
      !Object.hasOwn(
        this.pieces,
        pieceId,
      )
    ) {
      throw new Error(
        `Peça inválida: ${pieceId}`,
      );
    }
  }

  assertQuantity(
    quantity,
  ) {
    if (
      !Number.isInteger(
        quantity,
      ) ||
      quantity < 0
    ) {
      throw new Error(
        `Quantidade inválida: ${quantity}`,
      );
    }
  }
}

export {
  DEFAULT_PIECES,
};
