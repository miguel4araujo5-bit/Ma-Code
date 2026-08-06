import {
  RESOURCE_IDS,
} from '../data/resources.js';

function findPlayer(
  players,
  playerId,
) {
  return players.find(
    (player) =>
      player.id === playerId,
  );
}

function findTerritory(
  board,
  territoryId,
) {
  return board.territories.find(
    (territory) =>
      territory.id ===
      territoryId,
  );
}

function productionQuantity(
  building,
) {
  if (building === 'city') {
    return 2;
  }

  if (building === 'village') {
    return 1;
  }

  return 0;
}

function createEmptyProduction() {
  return Object.fromEntries(
    RESOURCE_IDS.map(
      (resourceId) => [
        resourceId,
        0,
      ],
    ),
  );
}

export class ProductionEngine {
  collectClaims({
    board,
    players,
    diceTotal,
  }) {
    if (
      !Number.isInteger(
        diceTotal,
      ) ||
      diceTotal < 2 ||
      diceTotal > 12
    ) {
      throw new Error(
        `Resultado de dados inválido: ${diceTotal}`,
      );
    }

    if (diceTotal === 7) {
      return [];
    }

    const claimsByPlayerResource =
      new Map();

    const producingTerritories =
      board.territories.filter(
        (territory) =>
          territory.number ===
            diceTotal &&
          territory.resourceId !==
            'abandoned' &&
          !territory.blocked,
      );

    for (
      const territory
      of producingTerritories
    ) {
      for (
        const vertexId
        of territory.vertexIds || []
      ) {
        const vertex =
          board.vertices.find(
            (item) =>
              item.id === vertexId,
          );

        if (
          !vertex?.building ||
          !vertex.ownerId
        ) {
          continue;
        }

        const player =
          findPlayer(
            players,
            vertex.ownerId,
          );

        if (!player) {
          continue;
        }

        const quantity =
          productionQuantity(
            vertex.building,
          );

        if (quantity <= 0) {
          continue;
        }

        const key =
          `${player.id}:${territory.resourceId}`;

        const current =
          claimsByPlayerResource.get(
            key,
          );

        if (current) {
          current.quantity +=
            quantity;

          current.territoryIds.push(
            territory.id,
          );
        } else {
          claimsByPlayerResource.set(
            key,
            {
              playerId:
                player.id,

              resourceId:
                territory.resourceId,

              quantity,

              territoryIds: [
                territory.id,
              ],
            },
          );
        }
      }
    }

    return [
      ...claimsByPlayerResource.values(),
    ];
  }

  distribute({
    board,
    players,
    bank,
    diceTotal,
  }) {
    const claims =
      this.collectClaims({
        board,
        players,
        diceTotal,
      });

    const result =
      bank.distributeProduction(
        claims.map(
          (claim) => ({
            playerId:
              claim.playerId,

            resourceId:
              claim.resourceId,

            quantity:
              claim.quantity,
          }),
        ),
      );

    const grantedKeys =
      new Set(
        result.granted.map(
          (claim) =>
            `${claim.playerId}:${claim.resourceId}`,
        ),
      );

    const granted = [];
    const denied = [];

    for (
      const claim
      of claims
    ) {
      const key =
        `${claim.playerId}:${claim.resourceId}`;

      if (
        grantedKeys.has(key)
      ) {
        const player =
          findPlayer(
            players,
            claim.playerId,
          );

        if (player) {
          player.addResource(
            claim.resourceId,
            claim.quantity,
          );

          granted.push({
            ...claim,
          });
        }
      } else {
        denied.push({
          ...claim,
        });
      }
    }

    return {
      diceTotal,
      claims,
      granted,
      denied,
      deniedResources:
        result.deniedResources,
      producingTerritoryIds:
        board.territories
          .filter(
            (territory) =>
              territory.number ===
                diceTotal &&
              territory.resourceId !==
                'abandoned' &&
              !territory.blocked,
          )
          .map(
            (territory) =>
              territory.id,
          ),
    };
  }

  grantInitialResources({
    board,
    player,
    bank,
    vertexId,
  }) {
    const vertex =
      board.vertices.find(
        (item) =>
          item.id === vertexId,
      );

    if (!vertex) {
      throw new Error(
        'O vértice inicial não existe.',
      );
    }

    const requested =
      createEmptyProduction();

    for (
      const territoryId
      of vertex.territoryIds || []
    ) {
      const territory =
        findTerritory(
          board,
          territoryId,
        );

      if (
        !territory ||
        territory.resourceId ===
          'abandoned'
      ) {
        continue;
      }

      requested[
        territory.resourceId
      ] += 1;
    }

    const granted =
      createEmptyProduction();

    const deniedResources = [];

    for (
      const resourceId
      of RESOURCE_IDS
    ) {
      const quantity =
        requested[
          resourceId
        ];

      if (quantity <= 0) {
        continue;
      }

      if (
        bank.withdraw(
          resourceId,
          quantity,
        )
      ) {
        player.addResource(
          resourceId,
          quantity,
        );

        granted[
          resourceId
        ] = quantity;
      } else {
        deniedResources.push(
          resourceId,
        );
      }
    }

    return {
      playerId:
        player.id,
      vertexId,
      requested,
      granted,
      deniedResources,
    };
  }
}
