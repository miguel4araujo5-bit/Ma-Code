const RESOURCE_IDS = [
  'stone',
  'cork',
  'wheat',
  'cod',
  'iron'
] as const

type Participant = {
  id: string
  name: string
  kind: 'human' | 'bot'
  icon: string | null
}

export type ConquistadorBotCommand = {
  type: string
  payload: Record<string, unknown>
}

const NUMBER_WEIGHT: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1
}

const findParticipant = (
  participants: Participant[],
  playerId: string | null | undefined
) =>
  participants.find(
    (participant) =>
      participant.id === playerId
  ) || null

const findPlayer = (
  game: any,
  playerId: string | null | undefined
) =>
  game?.players?.find(
    (player: any) =>
      player?.id === playerId
  ) || null

const findVertex = (
  game: any,
  vertexId: string
) =>
  game?.board?.vertices?.find(
    (vertex: any) =>
      vertex?.id === vertexId
  ) || null

const findEdge = (
  game: any,
  edgeId: string
) =>
  game?.board?.edges?.find(
    (edge: any) =>
      edge?.id === edgeId
  ) || null

const findTerritory = (
  game: any,
  territoryId: string
) =>
  game?.board?.territories?.find(
    (territory: any) =>
      territory?.id === territoryId
  ) || null

const territoryWeight = (
  territory: any
) => {
  if (!territory) {
    return 0
  }

  return NUMBER_WEIGHT[
    Number(territory.number)
  ] || 0
}

const scoreVertex = (
  game: any,
  vertexId: string,
  playerId: string
) => {
  const vertex =
    findVertex(game, vertexId)

  if (!vertex) {
    return -Infinity
  }

  const territories =
    (vertex.territoryIds || [])
      .map(
        (territoryId: string) =>
          findTerritory(
            game,
            territoryId
          )
      )
      .filter(Boolean)

  const resources =
    new Set(
      territories
        .map(
          (territory: any) =>
            territory.resourceId
        )
        .filter(
          (resourceId: string) =>
            resourceId &&
            resourceId !==
              'abandoned'
        )
    )

  let score =
    territories.reduce(
      (
        total: number,
        territory: any
      ) =>
        total +
        territoryWeight(
          territory
        ),
      0
    )

  score +=
    resources.size * 1.35

  if (vertex.isCoastal) {
    score += 0.9
  }

  const portTouch =
    (game?.board?.ports || [])
      .some(
        (port: any) =>
          Array.isArray(
            port?.vertexIds
          ) &&
          port.vertexIds.includes(
            vertexId
          )
      )

  if (portTouch) {
    score += 1.5
  }

  const friendlyNeighbors =
    (vertex.neighborVertexIds || [])
      .map(
        (id: string) =>
          findVertex(game, id)
      )
      .filter(
        (neighbor: any) =>
          neighbor?.ownerId ===
          playerId
      )
      .length

  score +=
    friendlyNeighbors * 0.25

  return score
}

const scoreEdge = (
  game: any,
  edgeId: string,
  playerId: string
) => {
  const edge =
    findEdge(game, edgeId)

  if (!edge) {
    return -Infinity
  }

  const endpointScore =
    Math.max(
      ...(edge.vertexIds || [])
        .map(
          (vertexId: string) =>
            scoreVertex(
              game,
              vertexId,
              playerId
            )
        ),
      0
    )

  const coastalBonus =
    edge.isCoastal
      ? 0.8
      : 0

  return endpointScore +
    coastalBonus
}

const chooseBestId = (
  ids: string[],
  scorer: (id: string) => number
) => {
  if (!ids.length) {
    return null
  }

  return [...ids]
    .sort(
      (first, second) => {
        const difference =
          scorer(second) -
          scorer(first)

        if (
          Math.abs(difference) >
          0.0001
        ) {
          return difference
        }

        return first.localeCompare(
          second
        )
      }
    )[0] || null
}

const createDiscardSelection = (
  player: any,
  required: number
) => {
  const result:
    Record<string, number> = {}

  const remaining =
    Object.fromEntries(
      RESOURCE_IDS.map(
        (resourceId) => [
          resourceId,
          Math.max(
            0,
            Number(
              player?.resources?.[
                resourceId
              ]
            ) || 0
          )
        ]
      )
    ) as Record<string, number>

  const reserveTarget:
    Record<string, number> = {
      cork: 2,
      iron: 2,
      wheat: 2,
      stone: 1,
      cod: 1
    }

  let left =
    Math.max(
      0,
      Number(required) || 0
    )

  while (left > 0) {
    const candidates =
      RESOURCE_IDS
        .filter(
          (resourceId) =>
            remaining[resourceId] > 0
        )
        .sort(
          (first, second) => {
            const firstSurplus =
              remaining[first] -
              reserveTarget[first]

            const secondSurplus =
              remaining[second] -
              reserveTarget[second]

            if (
              secondSurplus !==
              firstSurplus
            ) {
              return secondSurplus -
                firstSurplus
            }

            return remaining[second] -
              remaining[first]
          }
        )

    const resourceId =
      candidates[0]

    if (!resourceId) {
      break
    }

    remaining[resourceId] -= 1
    result[resourceId] =
      (result[resourceId] || 0) + 1
    left -= 1
  }

  return result
}

const opponentPresenceOnTerritory = (
  game: any,
  territory: any,
  botId: string
) => {
  if (!territory) {
    return 0
  }

  return (territory.vertexIds || [])
    .map(
      (vertexId: string) =>
        findVertex(game, vertexId)
    )
    .filter(
      (vertex: any) =>
        vertex?.building &&
        vertex.ownerId &&
        vertex.ownerId !== botId
    )
    .reduce(
      (
        total: number,
        vertex: any
      ) =>
        total +
        (vertex.building ===
        'city'
          ? 2
          : 1),
      0
    )
}

const scoreThreatTerritory = (
  game: any,
  territoryId: string,
  botId: string
) => {
  const territory =
    findTerritory(
      game,
      territoryId
    )

  if (!territory) {
    return -Infinity
  }

  return (
    territoryWeight(
      territory
    ) * 1.4 +
    opponentPresenceOnTerritory(
      game,
      territory,
      botId
    ) * 4
  )
}

const scoreStormEdge = (
  game: any,
  edgeId: string,
  botId: string
) => {
  const edge =
    findEdge(game, edgeId)

  if (!edge) {
    return -Infinity
  }

  let score = 1

  if (
    edge.segment ===
      'sea-route' &&
    edge.ownerId &&
    edge.ownerId !== botId
  ) {
    score += 8
  }

  for (
    const vertexId
    of edge.vertexIds || []
  ) {
    const vertex =
      findVertex(
        game,
        vertexId
      )

    if (
      vertex?.building &&
      vertex.ownerId &&
      vertex.ownerId !== botId
    ) {
      score +=
        vertex.building ===
        'city'
          ? 4
          : 2
    }
  }

  return score
}

const chooseVictim = (
  game: any,
  victimIds: string[]
) =>
  [...victimIds]
    .sort(
      (first, second) => {
        const firstPlayer =
          findPlayer(
            game,
            first
          )

        const secondPlayer =
          findPlayer(
            game,
            second
          )

        return (
          secondPlayer
            ?.getTotalResources?.() ||
          0
        ) - (
          firstPlayer
            ?.getTotalResources?.() ||
          0
        )
      }
    )[0] || null

const shouldUseStorm = (
  game: any,
  botId: string
) => {
  const opponentSeaRoutes =
    (game?.board?.edges || [])
      .filter(
        (edge: any) =>
          edge?.segment ===
            'sea-route' &&
          edge.ownerId &&
          edge.ownerId !== botId
      )
      .length

  return opponentSeaRoutes > 0 &&
    game
      .sevenEvents
      ?.getStormEdgeIds?.(
        game.board,
        game.threat
      )
      ?.length > 0
}

const chooseBuildCommand = (
  game: any,
  botId: string
): ConquistadorBotCommand => {
  const cityIds =
    game.getValidCityIds?.() || []

  if (cityIds.length) {
    const vertexId =
      chooseBestId(
        cityIds,
        (id) =>
          scoreVertex(
            game,
            id,
            botId
          )
      )

    if (vertexId) {
      return {
        type: 'buildCity',
        payload: {
          vertexId
        }
      }
    }
  }

  const villageIds =
    game.getValidVillageIds?.() || []

  if (villageIds.length) {
    const vertexId =
      chooseBestId(
        villageIds,
        (id) =>
          scoreVertex(
            game,
            id,
            botId
          )
      )

    if (vertexId) {
      return {
        type: 'buildVillage',
        payload: {
          vertexId
        }
      }
    }
  }

  const roadIds =
    game.getValidRoadIds?.() || []

  const seaRouteIds =
    game.getValidSeaRouteIds?.() || []

  const bestRoad =
    chooseBestId(
      roadIds,
      (id) =>
        scoreEdge(
          game,
          id,
          botId
        )
    )

  const bestSeaRoute =
    chooseBestId(
      seaRouteIds,
      (id) =>
        scoreEdge(
          game,
          id,
          botId
        ) + 0.55
    )

  const roadScore =
    bestRoad
      ? scoreEdge(
          game,
          bestRoad,
          botId
        )
      : -Infinity

  const seaScore =
    bestSeaRoute
      ? scoreEdge(
          game,
          bestSeaRoute,
          botId
        ) + 0.55
      : -Infinity

  if (
    bestSeaRoute &&
    seaScore > roadScore
  ) {
    return {
      type: 'buildSeaRoute',
      payload: {
        edgeId:
          bestSeaRoute
      }
    }
  }

  if (bestRoad) {
    return {
      type: 'buildRoad',
      payload: {
        edgeId:
          bestRoad
      }
    }
  }

  return {
    type: 'endTurn',
    payload: {}
  }
}

export const getConquistadorBotActorId = (
  game: any,
  participants: Participant[]
) => {
  if (!game || !participants?.length) {
    return null
  }

  if (
    game.phase ===
    'event-seven' &&
    game.sevenEvent?.step ===
      'discard'
  ) {
    const discardPlayer =
      game
        .getCurrentSevenDiscardPlayer?.()

    const participant =
      findParticipant(
        participants,
        discardPlayer?.id
      )

    return participant?.kind ===
      'bot'
      ? participant.id
      : null
  }

  const currentParticipant =
    findParticipant(
      participants,
      game.currentPlayer?.id
    )

  return currentParticipant?.kind ===
    'bot'
    ? currentParticipant.id
    : null
}

export const chooseConquistadorBotCommand = (
  game: any,
  participants: Participant[],
  botId: string
): ConquistadorBotCommand | null => {
  const participant =
    findParticipant(
      participants,
      botId
    )

  const player =
    findPlayer(
      game,
      botId
    )

  if (
    !participant ||
    participant.kind !== 'bot' ||
    !player ||
    game.phase === 'game-over'
  ) {
    return null
  }

  if (
    game.phase ===
    'event-seven' &&
    game.sevenEvent?.step ===
      'discard'
  ) {
    const entry =
      game
        .getCurrentSevenDiscardEntry?.()

    if (
      entry?.playerId !== botId
    ) {
      return null
    }

    return {
      type: 'discardForSeven',
      payload: {
        selection:
          createDiscardSelection(
            player,
            Number(
              entry.required
            ) || 0
          )
      }
    }
  }

  if (
    game.currentPlayer?.id !==
    botId
  ) {
    return null
  }

  switch (game.phase) {
    case 'setup-village': {
      const ids =
        game
          .getValidInitialVillageIds?.() ||
        []

      const vertexId =
        chooseBestId(
          ids,
          (id) =>
            scoreVertex(
              game,
              id,
              botId
            )
        )

      return vertexId
        ? {
            type:
              'placeInitialVillage',
            payload: {
              vertexId
            }
          }
        : null
    }

    case 'setup-road': {
      const roadIds =
        game
          .getValidInitialRoadIds?.() ||
        []

      const seaIds =
        game
          .getValidInitialSeaRouteIds?.() ||
        []

      const roadId =
        chooseBestId(
          roadIds,
          (id) =>
            scoreEdge(
              game,
              id,
              botId
            )
        )

      const seaId =
        chooseBestId(
          seaIds,
          (id) =>
            scoreEdge(
              game,
              id,
              botId
            ) + 0.4
        )

      if (
        seaId &&
        (!roadId ||
          scoreEdge(
            game,
            seaId,
            botId
          ) + 0.4 >
          scoreEdge(
            game,
            roadId,
            botId
          ))
      ) {
        return {
          type:
            'placeInitialSeaRoute',
          payload: {
            edgeId: seaId
          }
        }
      }

      return roadId
        ? {
            type:
              'placeInitialRoad',
            payload: {
              edgeId: roadId
            }
          }
        : null
    }

    case 'turn-roll':
      return {
        type: 'rollDice',
        payload: {}
      }

    case 'event-seven': {
      const step =
        game.sevenEvent?.step

      if (
        step ===
        'choose-threat'
      ) {
        return {
          type:
            'chooseSevenThreat',
          payload: {
            threatType:
              shouldUseStorm(
                game,
                botId
              )
                ? 'storm'
                : 'contrabandist'
          }
        }
      }

      if (
        step ===
        'choose-target'
      ) {
        if (
          game.sevenEvent
            ?.selectedThreat ===
          'storm'
        ) {
          const edgeIds =
            game
              .getSevenValidEdgeIds?.() ||
            []

          const edgeId =
            chooseBestId(
              edgeIds,
              (id) =>
                scoreStormEdge(
                  game,
                  id,
                  botId
                )
            )

          if (edgeId) {
            return {
              type:
                'placeSevenThreat',
              payload: {
                targetType:
                  'edge',
                targetId:
                  edgeId
              }
            }
          }
        }

        const territoryIds =
          game
            .getSevenValidTerritoryIds?.() ||
          []

        const territoryId =
          chooseBestId(
            territoryIds,
            (id) =>
              scoreThreatTerritory(
                game,
                id,
                botId
              )
          )

        return territoryId
          ? {
              type:
                'placeSevenThreat',
              payload: {
                targetType:
                  'territory',
                targetId:
                  territoryId
              }
            }
          : null
      }

      if (
        step ===
        'choose-victim'
      ) {
        const victimIds =
          game
            .getSevenEligibleVictimIds?.() ||
          []

        const victimId =
          chooseVictim(
            game,
            victimIds
          )

        if (victimId) {
          return {
            type:
              'resolveSevenVictim',
            payload: {
              victimId
            }
          }
        }

        if (
          game.sevenEvent
            ?.selectedThreat ===
          'storm'
        ) {
          return {
            type:
              'skipSevenTheft',
            payload: {}
          }
        }

        return null
      }

      return null
    }

    case 'turn-actions':
      return chooseBuildCommand(
        game,
        botId
      )

    default:
      return null
  }
}
