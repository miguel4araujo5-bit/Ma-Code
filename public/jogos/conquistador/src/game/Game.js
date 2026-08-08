import {
  GAME_CONFIG,
} from '../data/gameConfig.js';

import {
  BoardGenerator,
} from './BoardGenerator.js';

import {
  buildBoardTopology,
} from './BoardTopology.js';

import {
  Player,
} from './Player.js';

import {
  RulesEngine,
  BUILD_COSTS,
} from './RulesEngine.js';

import {
  ProductionEngine,
} from './ProductionEngine.js';

import {
  DiceEngine,
} from './DiceEngine.js';

import {
  Bank,
} from './Bank.js';

const GAME_PHASES = Object.freeze({
  SETUP_VILLAGE: 'setup-village',
  SETUP_ROAD: 'setup-road',
  TURN_ROLL: 'turn-roll',
  TURN_ACTIONS: 'turn-actions',
  GAME_OVER: 'game-over',
});

const HOUSE_PRESETS = Object.freeze([
  Object.freeze({
    id: 'atlantic',
    name: 'Casa do Atlântico',
    color: '#176b78',
    symbol: '≈',
  }),
  Object.freeze({
    id: 'mountain',
    name: 'Casa da Serra',
    color: '#44643c',
    symbol: '▲',
  }),
  Object.freeze({
    id: 'sun',
    name: 'Casa do Sol',
    color: '#b7791f',
    symbol: '☀',
  }),
  Object.freeze({
    id: 'tagus',
    name: 'Casa do Tejo',
    color: '#8c2f39',
    symbol: '◆',
  }),
]);

function createGameId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return (
    `game-${Date.now()}-` +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function createSetupOrder(playerCount) {
  const forward = Array.from(
    {
      length: playerCount,
    },
    (_, index) => index,
  );

  return [
    ...forward,
    ...[...forward].reverse(),
  ];
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value),
  );
}

function normalizePlayers(
  playerConfigurations,
) {
  if (
    !Array.isArray(
      playerConfigurations,
    ) ||
    playerConfigurations.length < 2 ||
    playerConfigurations.length > 4
  ) {
    throw new Error(
      'A partida deve ter entre 2 e 4 jogadores.',
    );
  }

  return playerConfigurations.map(
    (
      configuration,
      index,
    ) => {
      const house =
        HOUSE_PRESETS[index];

      return new Player({
        id:
          configuration.id ||
          `player-${index + 1}`,

        name:
          configuration.name ||
          `Jogador ${index + 1}`,

        houseId:
          configuration.houseId ||
          house.id,

        color:
          configuration.color ||
          house.color,

        symbol:
          configuration.symbol ||
          house.symbol,

        resources:
          configuration.resources,

        pieces:
          configuration.pieces,

        prestige:
          configuration.prestige,

        usedGuardCaptains:
          configuration
            .usedGuardCaptains,

        contractPrestige:
          configuration
            .contractPrestige,

        hasLargestNetwork:
          configuration
            .hasLargestNetwork,

        hasLargestMilitary:
          configuration
            .hasLargestMilitary,
      });
    },
  );
}

function restoreBank(bankData) {
  const bank =
    new Bank();

  if (
    bankData?.inventory
  ) {
    bank.inventory = {
      ...bank.inventory,
      ...bankData.inventory,
    };
  }

  return bank;
}

function prepareBoard(
  seed,
  boardData,
) {
  if (!boardData) {
    return buildBoardTopology(
      new BoardGenerator()
        .generate(seed),
    );
  }

  if (
    boardData.shape !==
      GAME_CONFIG
        .board
        .shape ||
    boardData.maskVersion !==
      GAME_CONFIG
        .board
        .maskVersion
  ) {
    throw new Error(
      'A gravação usa uma versão antiga do mapa e não pode ser retomada.',
    );
  }

  const board =
    clone(boardData);

  if (
    !Array.isArray(
      board.vertices,
    ) ||
    !Array.isArray(
      board.edges,
    )
  ) {
    return buildBoardTopology(
      board,
    );
  }

  if (
    board.vertices.length !==
      GAME_CONFIG
        .board
        .expectedVertexCount ||
    board.edges.length !==
      GAME_CONFIG
        .board
        .expectedEdgeCount
  ) {
    throw new Error(
      'A topologia guardada não corresponde ao mapa atual de Portugal Continental.',
    );
  }

  return board;
}

function depositCost(
  bank,
  cost,
) {
  for (
    const [
      resourceId,
      quantity,
    ]
    of Object.entries(cost)
  ) {
    bank.deposit(
      resourceId,
      quantity,
    );
  }
}

export class Game {
  constructor({
    id =
      createGameId(),

    seed =
      `CONQ-${Date.now()}`,

    players,

    board = null,

    bank = null,

    phase =
      GAME_PHASES
        .SETUP_VILLAGE,

    currentPlayerIndex = 0,

    setupOrder = null,

    setupStep = 0,

    pendingInitialVertexId =
      null,

    setupVillageCounts =
      null,

    lastRoll = null,

    history = [],

    winnerId = null,

    createdAt = null,

    updatedAt = null,

    diceState = null,

    turnNumber = 1,
  }) {
    this.id =
      id;

    this.seed =
      String(seed);

    this.players =
      normalizePlayers(
        players,
      );

    this.rules =
      new RulesEngine();

    this.production =
      new ProductionEngine();

    this.dice =
      new DiceEngine(
        `${this.seed}-DICE`,
      );

    if (
      Number.isInteger(
        diceState,
      ) &&
      diceState >= 0
    ) {
      this.dice
        .random
        .state =
        diceState >>> 0;
    }

    this.bank =
      bank instanceof Bank
        ? bank
        : restoreBank(
            bank,
          );

    this.board =
      prepareBoard(
        this.seed,
        board,
      );

    this.phase =
      phase;

    this.currentPlayerIndex =
      currentPlayerIndex;

    this.setupOrder =
      setupOrder ||
      createSetupOrder(
        this.players.length,
      );

    this.setupStep =
      setupStep;

    this.pendingInitialVertexId =
      pendingInitialVertexId;

    this.setupVillageCounts =
      setupVillageCounts ||
      Object.fromEntries(
        this.players.map(
          (player) => [
            player.id,
            0,
          ],
        ),
      );

    this.lastRoll =
      lastRoll;

    this.history =
      Array.isArray(
        history,
      )
        ? [...history]
        : [];

    this.winnerId =
      winnerId;

    this.turnNumber =
      Math.max(
        1,
        Number(
          turnNumber,
        ) || 1,
      );

    this.createdAt =
      createdAt ||
      new Date()
        .toISOString();

    this.updatedAt =
      updatedAt ||
      this.createdAt;

    this.synchronizeCurrentPlayer();
  }

  get currentPlayer() {
    return (
      this.players[
        this.currentPlayerIndex
      ] || null
    );
  }

  get winner() {
    if (!this.winnerId) {
      return null;
    }

    return (
      this.players.find(
        (player) =>
          player.id ===
          this.winnerId,
      ) || null
    );
  }

  synchronizeCurrentPlayer() {
    if (
      [
        GAME_PHASES
          .SETUP_VILLAGE,

        GAME_PHASES
          .SETUP_ROAD,
      ].includes(
        this.phase,
      )
    ) {
      const setupPlayerIndex =
        this.setupOrder[
          this.setupStep
        ];

      if (
        Number.isInteger(
          setupPlayerIndex,
        )
      ) {
        this.currentPlayerIndex =
          setupPlayerIndex;
      }
    }
  }

  touch() {
    this.updatedAt =
      new Date()
        .toISOString();
  }

  addHistory(
    type,
    message,
    details = {},
    playerId =
      this.currentPlayer
        ?.id || null,
  ) {
    const entry = {
      id:
        `event-${
          this.history.length + 1
        }-${Date.now()}`,

      at:
        new Date()
          .toISOString(),

      type,

      playerId,

      message,

      details,
    };

    this.history.push(
      entry,
    );

    this.touch();

    return entry;
  }

  placeInitialVillage(
    vertexId,
  ) {
    if (
      this.phase !==
      GAME_PHASES
        .SETUP_VILLAGE
    ) {
      return {
        success: false,

        reason:
          'Não está na fase de colocação de Vila.',
      };
    }

    const player =
      this.currentPlayer;

    const validation =
      this.rules
        .validateInitialVillage({
          board:
            this.board,

          player,

          vertexId,
        });

    if (
      !validation.valid
    ) {
      return {
        success: false,

        reason:
          validation.reason,
      };
    }

    if (
      !player.usePiece(
        'villages',
      )
    ) {
      return {
        success: false,

        reason:
          'Não existem Vilas disponíveis.',
      };
    }

    validation
      .vertex
      .building =
      'village';

    validation
      .vertex
      .ownerId =
      player.id;

    player.addPrestige(
      1,
    );

    this.setupVillageCounts[
      player.id
    ] =
      (
        this.setupVillageCounts[
          player.id
        ] || 0
      ) + 1;

    this.pendingInitialVertexId =
      validation
        .vertex
        .id;

    this.phase =
      GAME_PHASES
        .SETUP_ROAD;

    this.addHistory(
      'initial-village',

      `${player.name} fundou uma Vila inicial.`,

      {
        vertexId:
          validation
            .vertex
            .id,
      },
    );

    return {
      success: true,

      vertex:
        validation.vertex,
    };
  }

  finishInitialSegment({
    player,
    edge,
    segment,
    historyType,
    historyMessage,
  }) {
    if (
      !player.usePiece(
        'segments',
      )
    ) {
      return {
        success: false,

        reason:
          'Não existem segmentos disponíveis.',
      };
    }

    edge.segment =
      segment;

    edge.ownerId =
      player.id;

    const villageCount =
      this.setupVillageCounts[
        player.id
      ] || 0;

    let initialResources =
      null;

    if (
      villageCount === 2
    ) {
      initialResources =
        this.production
          .grantInitialResources({
            board:
              this.board,

            player,

            bank:
              this.bank,

            vertexId:
              this
                .pendingInitialVertexId,
          });
    }

    this.addHistory(
      historyType,

      historyMessage,

      {
        edgeId:
          edge.id,

        initialResources,
      },
    );

    this.pendingInitialVertexId =
      null;

    this.setupStep += 1;

    if (
      this.setupStep >=
      this.setupOrder.length
    ) {
      this.phase =
        GAME_PHASES
          .TURN_ROLL;

      this.currentPlayerIndex =
        0;

      this.turnNumber =
        1;

      this.addHistory(
        'setup-complete',

        'A preparação inicial terminou.',

        {},

        null,
      );
    } else {
      this.phase =
        GAME_PHASES
          .SETUP_VILLAGE;

      this.synchronizeCurrentPlayer();
    }

    this.touch();

    return {
      success: true,

      edge,

      initialResources,
    };
  }

  placeInitialRoad(
    edgeId,
  ) {
    if (
      this.phase !==
      GAME_PHASES
        .SETUP_ROAD
    ) {
      return {
        success: false,

        reason:
          'Não está na fase de colocação do segmento inicial.',
      };
    }

    const player =
      this.currentPlayer;

    const validation =
      this.rules
        .validateInitialRoad({
          board:
            this.board,

          player,

          edgeId,

          requiredVertexId:
            this
              .pendingInitialVertexId,
        });

    if (
      !validation.valid
    ) {
      return {
        success: false,

        reason:
          validation.reason,
      };
    }

    return this
      .finishInitialSegment({
        player,

        edge:
          validation.edge,

        segment:
          'road',

        historyType:
          'initial-road',

        historyMessage:
          `${player.name} construiu um Caminho Real inicial.`,
      });
  }

  placeInitialSeaRoute(
    edgeId,
  ) {
    if (
      this.phase !==
      GAME_PHASES
        .SETUP_ROAD
    ) {
      return {
        success: false,

        reason:
          'Não está na fase de colocação do segmento inicial.',
      };
    }

    const player =
      this.currentPlayer;

    const validation =
      this.rules
        .validateInitialSeaRoute({
          board:
            this.board,

          player,

          edgeId,

          requiredVertexId:
            this
              .pendingInitialVertexId,
        });

    if (
      !validation.valid
    ) {
      return {
        success: false,

        reason:
          validation.reason,
      };
    }

    return this
      .finishInitialSegment({
        player,

        edge:
          validation.edge,

        segment:
          'sea-route',

        historyType:
          'initial-sea-route',

        historyMessage:
          `${player.name} estabeleceu uma Rota Marítima inicial.`,
      });
  }

  rollDice() {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ROLL
    ) {
      return {
        success: false,

        reason:
          'Os dados já foram lançados neste turno.',
      };
    }

    const roll =
      this.dice.roll();

    this.lastRoll =
      roll;

    let productionResult =
      null;

    if (
      roll.total === 7
    ) {
      this.addHistory(
        'roll-seven',

        `${this.currentPlayer.name} lançou 7. A Tempestade será implementada na fase seguinte.`,

        {
          roll,
        },
      );
    } else {
      productionResult =
        this.production
          .distribute({
            board:
              this.board,

            players:
              this.players,

            bank:
              this.bank,

            diceTotal:
              roll.total,
          });

      this.addHistory(
        'production',

        `${this.currentPlayer.name} lançou ${roll.total}.`,

        {
          roll,

          production:
            productionResult,
        },
      );
    }

    this.phase =
      GAME_PHASES
        .TURN_ACTIONS;

    this.touch();

    return {
      success: true,

      roll,

      production:
        productionResult,
    };
  }

  buildRoad(
    edgeId,
  ) {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return {
        success: false,

        reason:
          'Só pode construir depois de lançar os dados.',
      };
    }

    const player =
      this.currentPlayer;

    const validation =
      this.rules
        .validateRoad({
          board:
            this.board,

          player,

          edgeId,
        });

    if (
      !validation.valid
    ) {
      return {
        success: false,

        reason:
          validation.reason,
      };
    }

    if (
      !player.pay(
        BUILD_COSTS.road,
      )
    ) {
      return {
        success: false,

        reason:
          'Não possui os recursos necessários.',
      };
    }

    depositCost(
      this.bank,

      BUILD_COSTS.road,
    );

    if (
      !player.usePiece(
        'segments',
      )
    ) {
      return {
        success: false,

        reason:
          'Não existem segmentos disponíveis.',
      };
    }

    validation
      .edge
      .segment =
      'road';

    validation
      .edge
      .ownerId =
      player.id;

    this.addHistory(
      'build-road',

      `${player.name} construiu um Caminho Real.`,

      {
        edgeId,
      },
    );

    return {
      success: true,

      edge:
        validation.edge,
    };
  }

  buildSeaRoute(
    edgeId,
  ) {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return {
        success: false,

        reason:
          'Só pode construir depois de lançar os dados.',
      };
    }

    const player =
      this.currentPlayer;

    const validation =
      this.rules
        .validateSeaRoute({
          board:
            this.board,

          player,

          edgeId,
        });

    if (
      !validation.valid
    ) {
      return {
        success: false,

        reason:
          validation.reason,
      };
    }

    if (
      !player.pay(
        BUILD_COSTS
          .seaRoute,
      )
    ) {
      return {
        success: false,

        reason:
          'Não possui os recursos necessários.',
      };
    }

    depositCost(
      this.bank,

      BUILD_COSTS
        .seaRoute,
    );

    if (
      !player.usePiece(
        'segments',
      )
    ) {
      return {
        success: false,

        reason:
          'Não existem segmentos disponíveis.',
      };
    }

    validation
      .edge
      .segment =
      'sea-route';

    validation
      .edge
      .ownerId =
      player.id;

    this.addHistory(
      'build-sea-route',

      `${player.name} estabeleceu uma Rota Marítima.`,

      {
        edgeId,
      },
    );

    return {
      success: true,

      edge:
        validation.edge,
    };
  }

  buildVillage(
    vertexId,
  ) {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return {
        success: false,

        reason:
          'Só pode construir depois de lançar os dados.',
      };
    }

    const player =
      this.currentPlayer;

    const validation =
      this.rules
        .validateVillage({
          board:
            this.board,

          player,

          vertexId,
        });

    if (
      !validation.valid
    ) {
      return {
        success: false,

        reason:
          validation.reason,
      };
    }

    if (
      !player.pay(
        BUILD_COSTS
          .village,
      )
    ) {
      return {
        success: false,

        reason:
          'Não possui os recursos necessários.',
      };
    }

    depositCost(
      this.bank,

      BUILD_COSTS
        .village,
    );

    player.usePiece(
      'villages',
    );

    validation
      .vertex
      .building =
      'village';

    validation
      .vertex
      .ownerId =
      player.id;

    player.addPrestige(
      1,
    );

    this.addHistory(
      'build-village',

      `${player.name} fundou uma Vila.`,

      {
        vertexId,
      },
    );

    this.checkVictory();

    return {
      success: true,

      vertex:
        validation.vertex,
    };
  }

  buildCity(
    vertexId,
  ) {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return {
        success: false,

        reason:
          'Só pode construir depois de lançar os dados.',
      };
    }

    const player =
      this.currentPlayer;

    const validation =
      this.rules
        .validateCity({
          board:
            this.board,

          player,

          vertexId,
        });

    if (
      !validation.valid
    ) {
      return {
        success: false,

        reason:
          validation.reason,
      };
    }

    if (
      !player.pay(
        BUILD_COSTS
          .city,
      )
    ) {
      return {
        success: false,

        reason:
          'Não possui os recursos necessários.',
      };
    }

    depositCost(
      this.bank,

      BUILD_COSTS
        .city,
    );

    player.usePiece(
      'cities',
    );

    player.returnPiece(
      'villages',
      1,
    );

    validation
      .vertex
      .building =
      'city';

    player.addPrestige(
      1,
    );

    this.addHistory(
      'build-city',

      `${player.name} ergueu uma Cidade Muralhada.`,

      {
        vertexId,
      },
    );

    this.checkVictory();

    return {
      success: true,

      vertex:
        validation.vertex,
    };
  }

  checkVictory() {
    const player =
      this.currentPlayer;

    if (
      player &&
      player.prestige >=
        GAME_CONFIG
          .victoryPrestige
    ) {
      this.winnerId =
        player.id;

      this.phase =
        GAME_PHASES
          .GAME_OVER;

      this.addHistory(
        'victory',

        `${player.name} venceu a partida com ${player.prestige} pontos de Prestígio.`,
      );

      return true;
    }

    return false;
  }

  endTurn() {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return {
        success: false,

        reason:
          'Ainda não pode terminar este turno.',
      };
    }

    if (
      this.winnerId
    ) {
      return {
        success: false,

        reason:
          'A partida já terminou.',
      };
    }

    const previousPlayer =
      this.currentPlayer;

    const nextIndex =
      (
        this.currentPlayerIndex +
        1
      ) %
      this.players.length;

    const nextPlayer =
      this.players[
        nextIndex
      ];

    this.addHistory(
      'end-turn',

      `${previousPlayer.name} concluiu a Jornada. É agora a vez de ${nextPlayer.name}.`,

      {},

      previousPlayer.id,
    );

    this.currentPlayerIndex =
      nextIndex;

    if (
      nextIndex === 0
    ) {
      this.turnNumber += 1;
    }

    this.phase =
      GAME_PHASES
        .TURN_ROLL;

    this.lastRoll =
      null;

    this.touch();

    return {
      success: true,

      currentPlayer:
        this.currentPlayer,
    };
  }

  getValidInitialVillageIds() {
    if (
      this.phase !==
      GAME_PHASES
        .SETUP_VILLAGE
    ) {
      return [];
    }

    return this.rules
      .getValidVillageVertexIds({
        board:
          this.board,

        player:
          this.currentPlayer,

        initialPlacement:
          true,
      });
  }

  getValidInitialRoadIds() {
    if (
      this.phase !==
      GAME_PHASES
        .SETUP_ROAD
    ) {
      return [];
    }

    return this.rules
      .getValidRoadEdgeIds({
        board:
          this.board,

        player:
          this.currentPlayer,

        initialPlacement:
          true,

        requiredVertexId:
          this
            .pendingInitialVertexId,
      });
  }

  getValidInitialSeaRouteIds() {
    if (
      this.phase !==
      GAME_PHASES
        .SETUP_ROAD
    ) {
      return [];
    }

    return this.rules
      .getValidSeaRouteEdgeIds({
        board:
          this.board,

        player:
          this.currentPlayer,

        initialPlacement:
          true,

        requiredVertexId:
          this
            .pendingInitialVertexId,
      });
  }

  getValidVillageIds() {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return [];
    }

    return this.rules
      .getValidVillageVertexIds({
        board:
          this.board,

        player:
          this.currentPlayer,
      });
  }

  getValidRoadIds() {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return [];
    }

    return this.rules
      .getValidRoadEdgeIds({
        board:
          this.board,

        player:
          this.currentPlayer,
      });
  }

  getValidSeaRouteIds() {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return [];
    }

    return this.rules
      .getValidSeaRouteEdgeIds({
        board:
          this.board,

        player:
          this.currentPlayer,
      });
  }

  getValidCityIds() {
    if (
      this.phase !==
      GAME_PHASES
        .TURN_ACTIONS
    ) {
      return [];
    }

    return this.board
      .vertices
      .filter(
        (vertex) =>
          vertex.ownerId ===
            this.currentPlayer
              .id &&
          vertex.building ===
            'village' &&
          this.rules
            .validateCity({
              board:
                this.board,

              player:
                this.currentPlayer,

              vertexId:
                vertex.id,
            })
            .valid,
      )
      .map(
        (vertex) =>
          vertex.id,
      );
  }

  toJSON() {
    return {
      id:
        this.id,

      seed:
        this.seed,

      players:
        this.players.map(
          (player) =>
            player.toJSON(),
        ),

      board:
        clone(
          this.board,
        ),

      bank: {
        inventory:
          this.bank
            .snapshot(),
      },

      phase:
        this.phase,

      currentPlayerIndex:
        this.currentPlayerIndex,

      setupOrder: [
        ...this.setupOrder,
      ],

      setupStep:
        this.setupStep,

      pendingInitialVertexId:
        this
          .pendingInitialVertexId,

      setupVillageCounts: {
        ...this
          .setupVillageCounts,
      },

      lastRoll:
        this.lastRoll
          ? {
              ...this.lastRoll,
            }
          : null,

      history:
        this.history.map(
          (entry) =>
            clone(
              entry,
            ),
        ),

      winnerId:
        this.winnerId,

      createdAt:
        this.createdAt,

      updatedAt:
        this.updatedAt,

      diceState:
        this.dice
          .random
          .state >>> 0,

      turnNumber:
        this.turnNumber,
    };
  }

  static fromJSON(
    data,
  ) {
    if (
      !data ||
      !Array.isArray(
        data.players,
      )
    ) {
      throw new Error(
        'A gravação da partida não é válida.',
      );
    }

    return new Game({
      ...data,

      players:
        data.players,
    });
  }
}

export {
  GAME_PHASES,
  HOUSE_PRESETS,
};
