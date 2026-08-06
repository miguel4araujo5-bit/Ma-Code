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

const GAME_PHASES =
  Object.freeze({
    SETUP_VILLAGE:
      'setup-village',

    SETUP_ROAD:
      'setup-road',

    TURN_ROLL:
      'turn-roll',

    TURN_ACTIONS:
      'turn-actions',

    GAME_OVER:
      'game-over',
  });

const HOUSE_PRESETS =
  Object.freeze([
    Object.freeze({
      id: 'atlantic',
      name:
        'Casa do Atlântico',
      color: '#164E73',
      symbol: '≈',
    }),

    Object.freeze({
      id: 'mountain',
      name:
        'Casa da Serra',
      color: '#276749',
      symbol: '▲',
    }),

    Object.freeze({
      id: 'sun',
      name:
        'Casa do Sol',
      color: '#B7791F',
      symbol: '☀',
    }),

    Object.freeze({
      id: 'tagus',
      name:
        'Casa do Tejo',
      color: '#8C2F39',
      symbol: '◆',
    }),
  ]);

function createGameId() {
  if (
    globalThis.crypto
      ?.randomUUID
  ) {
    return (
      globalThis.crypto
        .randomUUID()
    );
  }

  return (
    `game-${Date.now()}-` +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function createSetupOrder(
  playerCount,
) {
  const forward =
    Array.from(
      {
        length:
          playerCount,
      },
      (
        _,
        index,
      ) => index,
    );

  return [
    ...forward,
    ...[
      ...forward,
    ].reverse(),
  ];
}

function cloneBoard(
  board,
) {
  return JSON.parse(
    JSON.stringify(
      board,
    ),
  );
}

function normalizePlayers(
  playerConfigurations,
) {
  if (
    !Array.isArray(
      playerConfigurations,
    ) ||
    playerConfigurations.length <
      2 ||
    playerConfigurations.length >
      4
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
        HOUSE_PRESETS[
          index
        ];

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
      });
    },
  );
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

    setupVillageCounts = null,

    lastRoll = null,

    history = [],

    winnerId = null,

    createdAt = null,
    updatedAt = null,
  }) {
    this.id = id;
    this.seed = seed;

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
        `${seed}-DICE`,
      );

    this.bank =
      bank instanceof Bank
        ? bank
        : new Bank();

    if (
      bank &&
      !(bank instanceof Bank)
    ) {
      this.bank.inventory = {
        ...this.bank.inventory,
        ...(bank.inventory ||
          bank),
      };
    }

    if (board) {
      this.board =
        cloneBoard(
          board,
        );
    } else {
      const generated =
        new BoardGenerator()
          .generate(
            seed,
          );

      this.board =
        buildBoardTopology(
          generated,
        );
    }

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
      setupVillageCounts || Object.fromEntries(
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
      Array.isArray(history)
        ? [...history]
        : [];

    this.winnerId =
      winnerId;

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
      this.phase ===
        GAME_PHASES
          .SETUP_VILLAGE ||
      this.phase ===
        GAME_PHASES
          .SETUP_ROAD
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
      playerId:
        this.currentPlayer
          ?.id || null,

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

    const vertex =
      validation.vertex;

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

    vertex.building =
      'village';

    vertex.ownerId =
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
      vertex.id;

    this.phase =
      GAME_PHASES
        .SETUP_ROAD;

    this.addHistory(
      'initial-village',
      `${player.name} fundou uma Vila inicial.`,
      {
        vertexId:
          vertex.id,
      },
    );

    return {
      success: true,
      vertex,
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
          'Não está na fase de colocação do Caminho inicial.',
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
            this.pendingInitialVertexId,
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

    const edge =
      validation.edge;

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
      'road';

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
              this.pendingInitialVertexId,
          });
    }

    this.addHistory(
      'initial-road',
      `${player.name} construiu um Caminho Real inicial.`,
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

      this.addHistory(
        'setup-complete',
        'A preparação inicial terminou.',
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
        `${this.currentPlayer.name} lançou 7. O evento especial será resolvido numa fase posterior.`,
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

    for (
      const [
        resourceId,
        quantity,
      ]
      of Object.entries(
        BUILD_COSTS.road,
      )
    ) {
      this.bank.deposit(
        resourceId,
        quantity,
      );
    }

    if (
      !player.usePiece(
        'segments',
      )
    ) {
      return {
        success: false,
        reason:
          'Não possui segmentos disponíveis.',
      };
    }

    validation.edge.segment =
      'road';

    validation.edge.ownerId =
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
        BUILD_COSTS.village,
      )
    ) {
      return {
        success: false,
        reason:
          'Não possui os recursos necessários.',
      };
    }

    for (
      const [
        resourceId,
        quantity,
      ]
      of Object.entries(
        BUILD_COSTS.village,
      )
    ) {
      this.bank.deposit(
        resourceId,
        quantity,
      );
    }

    if (
      !player.usePiece(
        'villages',
      )
    ) {
      return {
        success: false,
        reason:
          'Não possui Vilas disponíveis.',
      };
    }

    validation.vertex.building =
      'village';

    validation.vertex.ownerId =
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
        BUILD_COSTS.city,
      )
    ) {
      return {
        success: false,
        reason:
          'Não possui os recursos necessários.',
      };
    }

    for (
      const [
        resourceId,
        quantity,
      ]
      of Object.entries(
        BUILD_COSTS.city,
      )
    ) {
      this.bank.deposit(
        resourceId,
        quantity,
      );
    }

    if (
      !player.usePiece(
        'cities',
      )
    ) {
      return {
        success: false,
        reason:
          'Não possui Cidades disponíveis.',
      };
    }

    player.returnPiece(
      'villages',
      1,
    );

    validation.vertex.building =
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
      player.prestige >= 12
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

    this.currentPlayerIndex =
      (
        this.currentPlayerIndex +
        1
      ) %
      this.players.length;

    this.phase =
      GAME_PHASES
        .TURN_ROLL;

    this.lastRoll =
      null;

    this.addHistory(
      'end-turn',
      `${previousPlayer.name} concluiu a Jornada. É agora a vez de ${this.currentPlayer.name}.`,
    );

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
          this.pendingInitialVertexId,
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
        cloneBoard(
          this.board,
        ),

      bank: {
        inventory:
          this.bank.snapshot(),
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
        this.pendingInitialVertexId,

      setupVillageCounts: {
        ...this.setupVillageCounts,
      },

      lastRoll:
        this.lastRoll
          ? {
              ...this.lastRoll,
            }
          : null,

      history:
        this.history.map(
          (entry) => ({
            ...entry,
          }),
        ),

      winnerId:
        this.winnerId,

      createdAt:
        this.createdAt,

      updatedAt:
        this.updatedAt,
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
        data.players.map(
          (player) =>
            Player
              .fromJSON(
                player,
              )
              .toJSON(),
        ),
    });
  }
}

export {
  GAME_PHASES,
  HOUSE_PRESETS,
};
