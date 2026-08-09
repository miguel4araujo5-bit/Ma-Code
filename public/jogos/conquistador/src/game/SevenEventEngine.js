import { RESOURCE_IDS } from '../data/resources.js';

const THREAT_TYPES = Object.freeze({
  CONTRABANDIST: 'contrabandist',
  STORM: 'storm',
});

const TARGET_TYPES = Object.freeze({
  TERRITORY: 'territory',
  EDGE: 'edge',
});

function emptyThreat() {
  return {
    type: null,
    targetType: null,
    targetId: null,
  };
}

function findTerritory(board, territoryId) {
  return board?.territories?.find(
    (territory) => territory.id === territoryId,
  ) || null;
}

function findEdge(board, edgeId) {
  return board?.edges?.find(
    (edge) => edge.id === edgeId,
  ) || null;
}

function findVertex(board, vertexId) {
  return board?.vertices?.find(
    (vertex) => vertex.id === vertexId,
  ) || null;
}

function findPlayer(players, playerId) {
  return players?.find(
    (player) => player.id === playerId,
  ) || null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function playerHasResources(player) {
  return Boolean(
    player &&
    typeof player.getTotalResources === 'function' &&
    player.getTotalResources() > 0,
  );
}

function territoryBuildingOwnerIds(board, territory, coastalOnly = false) {
  if (!territory) {
    return [];
  }

  return unique(
    (territory.vertexIds || [])
      .map((vertexId) => findVertex(board, vertexId))
      .filter((vertex) => {
        if (!vertex?.building || !vertex.ownerId) {
          return false;
        }

        return !coastalOnly || vertex.isCoastal;
      })
      .map((vertex) => vertex.ownerId),
  );
}

function seaPresenceOwnerIdsAroundTerritory(board, territory) {
  if (!territory) {
    return [];
  }

  return unique(
    (territory.edgeIds || [])
      .map((edgeId) => findEdge(board, edgeId))
      .filter(
        (edge) =>
          edge?.isCoastal &&
          edge.segment === 'sea-route' &&
          edge.ownerId,
      )
      .map((edge) => edge.ownerId),
  );
}

function seaPresenceOwnerIdsAroundEdge(board, targetEdge) {
  if (!targetEdge) {
    return [];
  }

  const endpointIds = new Set(targetEdge.vertexIds || []);

  const buildingOwners = unique(
    [...endpointIds]
      .map((vertexId) => findVertex(board, vertexId))
      .filter(
        (vertex) =>
          vertex?.isCoastal &&
          vertex.building &&
          vertex.ownerId,
      )
      .map((vertex) => vertex.ownerId),
  );

  const routeOwners = unique(
    (board?.edges || [])
      .filter(
        (edge) =>
          edge?.isCoastal &&
          edge.segment === 'sea-route' &&
          edge.ownerId &&
          (edge.vertexIds || []).some(
            (vertexId) => endpointIds.has(vertexId),
          ),
      )
      .map((edge) => edge.ownerId),
  );

  return unique([
    ...buildingOwners,
    ...routeOwners,
  ]);
}

function filterVictims(players, activePlayerId, ownerIds) {
  const ownerIdSet = new Set(ownerIds);

  return players
    .filter(
      (player) =>
        player.id !== activePlayerId &&
        ownerIdSet.has(player.id) &&
        playerHasResources(player),
    )
    .map((player) => player.id);
}

export class SevenEventEngine {
  createEvent(players, rollerPlayerId) {
    const discardQueue = players
      .map((player) => ({
        playerId: player.id,
        required: this.getDiscardRequirement(player),
      }))
      .filter((entry) => entry.required > 0);

    return {
      rollerPlayerId,
      step: discardQueue.length > 0 ? 'discard' : 'choose-threat',
      discardQueue,
      discardIndex: 0,
      selectedThreat: null,
      targetType: null,
      targetId: null,
      eligibleVictimIds: [],
      startedAt: new Date().toISOString(),
    };
  }

  getDiscardRequirement(player) {
    const total = player?.getTotalResources?.() || 0;
    return total > 7 ? Math.floor(total / 2) : 0;
  }

  getCurrentDiscardEntry(event) {
    if (!event || event.step !== 'discard') {
      return null;
    }

    return event.discardQueue?.[event.discardIndex] || null;
  }

  validateDiscard(player, selection, required) {
    if (!player) {
      return {
        valid: false,
        reason: 'O jogador do descarte não existe.',
      };
    }

    if (!Number.isInteger(required) || required < 0) {
      return {
        valid: false,
        reason: 'A quantidade de descarte é inválida.',
      };
    }

    const normalized = Object.fromEntries(
      RESOURCE_IDS.map((resourceId) => [
        resourceId,
        Number(selection?.[resourceId] || 0),
      ]),
    );

    for (const resourceId of RESOURCE_IDS) {
      const quantity = normalized[resourceId];

      if (!Number.isInteger(quantity) || quantity < 0) {
        return {
          valid: false,
          reason: 'As quantidades de descarte devem ser inteiros não negativos.',
        };
      }

      if (quantity > player.getResource(resourceId)) {
        return {
          valid: false,
          reason: `Não existem cartas suficientes de ${resourceId} para esse descarte.`,
        };
      }
    }

    const total = Object.values(normalized).reduce(
      (sum, quantity) => sum + quantity,
      0,
    );

    if (total !== required) {
      return {
        valid: false,
        reason: `Tem de descartar exatamente ${required} recurso${required === 1 ? '' : 's'}.`,
      };
    }

    return {
      valid: true,
      reason: null,
      selection: normalized,
    };
  }

  getContrabandistTerritoryIds(board, activeThreat = null) {
    const currentId =
      activeThreat?.type === THREAT_TYPES.CONTRABANDIST &&
      activeThreat?.targetType === TARGET_TYPES.TERRITORY
        ? activeThreat.targetId
        : null;

    return (board?.territories || [])
      .filter((territory) => territory.id !== currentId)
      .map((territory) => territory.id);
  }

  getStormTerritoryIds(board, activeThreat = null) {
    const currentId =
      activeThreat?.type === THREAT_TYPES.STORM &&
      activeThreat?.targetType === TARGET_TYPES.TERRITORY
        ? activeThreat.targetId
        : null;

    return (board?.territories || [])
      .filter(
        (territory) =>
          territory.isCoastal &&
          territory.id !== currentId,
      )
      .map((territory) => territory.id);
  }

  getStormEdgeIds(board, activeThreat = null) {
    const currentId =
      activeThreat?.type === THREAT_TYPES.STORM &&
      activeThreat?.targetType === TARGET_TYPES.EDGE
        ? activeThreat.targetId
        : null;

    return (board?.edges || [])
      .filter(
        (edge) => edge.isCoastal && edge.id !== currentId,
      )
      .map((edge) => edge.id);
  }

  validateTarget({
    board,
    threatType,
    targetType,
    targetId,
    activeThreat,
  }) {
    if (threatType === THREAT_TYPES.CONTRABANDIST) {
      if (targetType !== TARGET_TYPES.TERRITORY) {
        return {
          valid: false,
          reason: 'O Contrabandista tem de ser colocado num território.',
        };
      }

      const validIds = this.getContrabandistTerritoryIds(
        board,
        activeThreat,
      );

      return validIds.includes(targetId)
        ? { valid: true, reason: null }
        : {
            valid: false,
            reason: 'Esse território não é um destino válido para o Contrabandista.',
          };
    }

    if (threatType === THREAT_TYPES.STORM) {
      const validIds =
        targetType === TARGET_TYPES.TERRITORY
          ? this.getStormTerritoryIds(board, activeThreat)
          : targetType === TARGET_TYPES.EDGE
            ? this.getStormEdgeIds(board, activeThreat)
            : [];

      return validIds.includes(targetId)
        ? { valid: true, reason: null }
        : {
            valid: false,
            reason: 'Esse local não é um destino válido para a Tempestade Atlântica.',
          };
    }

    return {
      valid: false,
      reason: 'A ameaça escolhida não é válida.',
    };
  }

  getVictimIds({
    board,
    players,
    activePlayerId,
    threatType,
    targetType,
    targetId,
  }) {
    if (threatType === THREAT_TYPES.CONTRABANDIST) {
      const territory = findTerritory(board, targetId);
      const ownerIds = territoryBuildingOwnerIds(board, territory);
      return filterVictims(players, activePlayerId, ownerIds);
    }

    if (threatType !== THREAT_TYPES.STORM) {
      return [];
    }

    if (targetType === TARGET_TYPES.TERRITORY) {
      const territory = findTerritory(board, targetId);
      const ownerIds = unique([
        ...territoryBuildingOwnerIds(board, territory, true),
        ...seaPresenceOwnerIdsAroundTerritory(board, territory),
      ]);

      return filterVictims(players, activePlayerId, ownerIds);
    }

    if (targetType === TARGET_TYPES.EDGE) {
      const edge = findEdge(board, targetId);
      const ownerIds = seaPresenceOwnerIdsAroundEdge(board, edge);
      return filterVictims(players, activePlayerId, ownerIds);
    }

    return [];
  }

  clearThreat(board, threat) {
    if (!threat?.type || !threat?.targetId) {
      return;
    }

    if (threat.targetType === TARGET_TYPES.TERRITORY) {
      const territory = findTerritory(board, threat.targetId);

      if (territory?.blockedByThreat === threat.type) {
        territory.blocked = false;
        territory.blockedByThreat = null;
      }
    }

    if (
      threat.type === THREAT_TYPES.STORM &&
      threat.targetType === TARGET_TYPES.EDGE
    ) {
      const edge = findEdge(board, threat.targetId);

      if (edge) {
        edge.stormBlocked = false;
      }
    }
  }

  applyThreat(board, threatType, targetType, targetId) {
    const threat = {
      type: threatType,
      targetType,
      targetId,
    };

    if (targetType === TARGET_TYPES.TERRITORY) {
      const territory = findTerritory(board, targetId);

      if (!territory) {
        throw new Error('O território da ameaça não existe.');
      }

      territory.blocked = true;
      territory.blockedByThreat = threatType;
    }

    if (
      threatType === THREAT_TYPES.STORM &&
      targetType === TARGET_TYPES.EDGE
    ) {
      const edge = findEdge(board, targetId);

      if (!edge) {
        throw new Error('A ligação marítima da Tempestade não existe.');
      }

      edge.stormBlocked = true;
    }

    return threat;
  }

  moveThreat({
    board,
    activeThreat,
    threatType,
    targetType,
    targetId,
  }) {
    const validation = this.validateTarget({
      board,
      threatType,
      targetType,
      targetId,
      activeThreat,
    });

    if (!validation.valid) {
      return validation;
    }

    this.clearThreat(board, activeThreat);

    return {
      valid: true,
      reason: null,
      threat: this.applyThreat(
        board,
        threatType,
        targetType,
        targetId,
      ),
    };
  }

  stealRandomResource({
    fromPlayer,
    toPlayer,
    random,
  }) {
    if (!fromPlayer || !toPlayer) {
      return null;
    }

    const pool = [];

    for (const resourceId of RESOURCE_IDS) {
      const quantity = fromPlayer.getResource(resourceId);

      for (let index = 0; index < quantity; index += 1) {
        pool.push(resourceId);
      }
    }

    if (pool.length === 0) {
      return null;
    }

    const resourceId = random.pick(pool);

    if (!fromPlayer.removeResource(resourceId, 1)) {
      return null;
    }

    toPlayer.addResource(resourceId, 1);

    return resourceId;
  }

  normalizeThreat(value) {
    if (
      !value ||
      !Object.values(THREAT_TYPES).includes(value.type) ||
      !Object.values(TARGET_TYPES).includes(value.targetType) ||
      !value.targetId
    ) {
      return emptyThreat();
    }

    return {
      type: value.type,
      targetType: value.targetType,
      targetId: String(value.targetId),
    };
  }

  normalizeEvent(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return {
      rollerPlayerId: value.rollerPlayerId || null,
      step: value.step || 'choose-threat',
      discardQueue: Array.isArray(value.discardQueue)
        ? value.discardQueue.map((entry) => ({
            playerId: entry.playerId,
            required: Number(entry.required) || 0,
          }))
        : [],
      discardIndex: Math.max(0, Number(value.discardIndex) || 0),
      selectedThreat: value.selectedThreat || null,
      targetType: value.targetType || null,
      targetId: value.targetId || null,
      eligibleVictimIds: Array.isArray(value.eligibleVictimIds)
        ? [...value.eligibleVictimIds]
        : [],
      startedAt: value.startedAt || new Date().toISOString(),
    };
  }

  getPlayer(players, playerId) {
    return findPlayer(players, playerId);
  }
}

export {
  THREAT_TYPES,
  TARGET_TYPES,
};

export default SevenEventEngine;
