import {
  Game,
  GAME_PHASES,
  HOUSE_PRESETS,
} from './game/Game.js';

import {
  SaveManager,
} from './storage/SaveManager.js';

import {
  RESOURCE_IDS,
  RESOURCES,
} from './data/resources.js';

const app =
  document.querySelector(
    '#app',
  );

const saveManager =
  new SaveManager();

let game = null;

let selectedAction = null;

let statusMessage = '';

let statusType = 'info';

const RESOURCE_LABELS = {
  cork: 'Cortiça',
  stone: 'Pedra',
  wheat: 'Trigo',
  cod: 'Bacalhau',
  iron: 'Ferro',
};

const RESOURCE_SYMBOLS = {
  cork: '◉',
  stone: '⬟',
  wheat: '✦',
  cod: '≈',
  iron: '◆',
};

const RESOURCE_CLASSES = {
  cork: 'resource-cork',
  stone: 'resource-stone',
  wheat: 'resource-wheat',
  cod: 'resource-cod',
  iron: 'resource-iron',
  abandoned:
    'resource-abandoned',
};

function escapeHtml(
  value,
) {
  return String(
    value ?? '',
  )
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
    .replaceAll(
      "'",
      '&#039;',
    );
}

function setStatus(
  message,
  type = 'info',
) {
  statusMessage =
    message || '';

  statusType =
    type;

  renderStatus();
}

function renderStatus() {
  const element =
    document.querySelector(
      '#status-message',
    );

  if (!element) {
    return;
  }

  element.className =
    `status-message status-${statusType}`;

  element.textContent =
    statusMessage;
}

function getResourceDefinition(
  resourceId,
) {
  if (
    Array.isArray(
      RESOURCES,
    )
  ) {
    return RESOURCES.find(
      (resource) =>
        resource.id ===
        resourceId,
    );
  }

  return RESOURCES?.[
    resourceId
  ];
}

function getResourceLabel(
  resourceId,
) {
  return (
    getResourceDefinition(
      resourceId,
    )?.name ||
    RESOURCE_LABELS[
      resourceId
    ] ||
    resourceId
  );
}

function getPhaseLabel() {
  if (!game) {
    return '';
  }

  const labels = {
    [GAME_PHASES.SETUP_VILLAGE]:
      'Colocar Vila inicial',

    [GAME_PHASES.SETUP_ROAD]:
      'Colocar Caminho inicial',

    [GAME_PHASES.TURN_ROLL]:
      'Lançar os dados',

    [GAME_PHASES.TURN_ACTIONS]:
      'Construir ou terminar o turno',

    [GAME_PHASES.GAME_OVER]:
      'Partida terminada',
  };

  return (
    labels[game.phase] ||
    game.phase
  );
}

function saveGame() {
  if (!game) {
    return;
  }

  const result =
    saveManager.save(
      game,
    );

  if (
    !result.success
  ) {
    setStatus(
      result.reason,
      'error',
    );
  }
}

function setAction(
  action,
) {
  selectedAction =
    selectedAction ===
    action
      ? null
      : action;

  renderGame();
}

function createPlayerFields(
  count,
) {
  return Array.from(
    {
      length: count,
    },
    (
      _,
      index,
    ) => {
      const house =
        HOUSE_PRESETS[
          index
        ];

      return `
        <label class="player-config-card">
          <span
            class="player-house-marker"
            style="
              --player-color:
                ${house.color};
            "
          >
            ${escapeHtml(
              house.symbol,
            )}
          </span>

          <span class="player-config-content">
            <strong>
              ${escapeHtml(
                house.name,
              )}
            </strong>

            <input
              type="text"
              name="player-${index}"
              maxlength="24"
              value="Jogador ${index + 1}"
              aria-label="Nome do jogador ${index + 1}"
            />
          </span>
        </label>
      `;
    },
  ).join('');
}

function renderHome() {
  selectedAction = null;

  app.innerHTML = `
    <main class="home-screen">
      <section class="hero-panel">
        <div class="hero-crest">
          <span>✦</span>
        </div>

        <p class="eyebrow">
          Terras e Rotas do Atlântico
        </p>

        <h1>
          Conquistador
        </h1>

        <p class="hero-description">
          Desenvolva Vilas, construa Caminhos
          Reais e faça crescer a influência
          da sua Casa Portuguesa.
        </p>

        <div class="hero-actions">
          <button
            id="new-game-button"
            class="button button-primary button-large"
            type="button"
          >
            Nova partida
          </button>

          ${
            saveManager.hasSave()
              ? `
                <button
                  id="continue-game-button"
                  class="button button-secondary button-large"
                  type="button"
                >
                  Continuar partida
                </button>
              `
              : ''
          }
        </div>

        <p class="prototype-notice">
          Versão jogável em desenvolvimento:
          Vilas, Caminhos, produção e turnos.
        </p>
      </section>
    </main>
  `;

  document
    .querySelector(
      '#new-game-button',
    )
    ?.addEventListener(
      'click',
      () => {
        renderNewGame();
      },
    );

  document
    .querySelector(
      '#continue-game-button',
    )
    ?.addEventListener(
      'click',
      () => {
        const result =
          saveManager.load(
            Game,
          );

        if (
          !result.success
        ) {
          setStatus(
            result.reason,
            'error',
          );

          return;
        }

        game =
          result.game;

        selectedAction =
          null;

        renderGame();

        setStatus(
          'Partida retomada.',
          'success',
        );
      },
    );
}

function renderNewGame(
  playerCount = 3,
) {
  app.innerHTML = `
    <main class="setup-screen">
      <section class="setup-panel">
        <button
          id="back-home-button"
          class="text-button"
          type="button"
        >
          ← Voltar
        </button>

        <p class="eyebrow">
          Preparar expedição
        </p>

        <h1>
          Nova partida
        </h1>

        <form id="new-game-form">
          <fieldset class="player-count-fieldset">
            <legend>
              Número de jogadores
            </legend>

            <div class="segmented-control">
              ${[2, 3, 4]
                .map(
                  (count) => `
                    <button
                      class="
                        segmented-option
                        ${
                          count ===
                          playerCount
                            ? 'is-active'
                            : ''
                        }
                      "
                      type="button"
                      data-player-count="${count}"
                    >
                      ${count}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </fieldset>

          <div
            id="player-configurations"
            class="player-configurations"
          >
            ${createPlayerFields(
              playerCount,
            )}
          </div>

          <label class="seed-field">
            <span>
              Seed do tabuleiro
            </span>

            <input
              type="text"
              name="seed"
              value="CONQ-${Date.now()}"
              maxlength="80"
            />

            <small>
              A mesma seed gera o mesmo tabuleiro.
            </small>
          </label>

          <button
            class="button button-primary button-large"
            type="submit"
          >
            Iniciar Jornada
          </button>
        </form>
      </section>
    </main>
  `;

  document
    .querySelector(
      '#back-home-button',
    )
    ?.addEventListener(
      'click',
      renderHome,
    );

  document
    .querySelectorAll(
      '[data-player-count]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            renderNewGame(
              Number(
                button.dataset
                  .playerCount,
              ),
            );
          },
        );
      },
    );

  document
    .querySelector(
      '#new-game-form',
    )
    ?.addEventListener(
      'submit',
      (
        event,
      ) => {
        event.preventDefault();

        const formData =
          new FormData(
            event.currentTarget,
          );

        const players =
          Array.from(
            {
              length:
                playerCount,
            },
            (
              _,
              index,
            ) => {
              const house =
                HOUSE_PRESETS[
                  index
                ];

              return {
                id:
                  `player-${index + 1}`,

                name:
                  String(
                    formData.get(
                      `player-${index}`,
                    ) ||
                    `Jogador ${index + 1}`,
                  ).trim(),

                houseId:
                  house.id,

                color:
                  house.color,

                symbol:
                  house.symbol,
              };
            },
          );

        const seed =
          String(
            formData.get(
              'seed',
            ) ||
            `CONQ-${Date.now()}`,
          ).trim();

        try {
          game =
            new Game({
              seed,
              players,
            });

          selectedAction =
            null;

          saveGame();

          renderGame();

          setStatus(
            `${game.currentPlayer.name}: selecione um local para a sua primeira Vila.`,
            'info',
          );
        } catch (
          error
        ) {
          setStatus(
            error instanceof Error
              ? error.message
              : 'Não foi possível iniciar a partida.',
            'error',
          );
        }
      },
    );
}

function computeBoardGeometry() {
  const vertices =
    game.board.vertices;

  const minimumX =
    Math.min(
      ...vertices.map(
        (vertex) =>
          vertex.x,
      ),
    );

  const maximumX =
    Math.max(
      ...vertices.map(
        (vertex) =>
          vertex.x,
      ),
    );

  const minimumY =
    Math.min(
      ...vertices.map(
        (vertex) =>
          vertex.y,
      ),
    );

  const maximumY =
    Math.max(
      ...vertices.map(
        (vertex) =>
          vertex.y,
      ),
    );

  const padding = 90;

  return {
    minimumX,
    minimumY,
    padding,

    width:
      maximumX -
      minimumX +
      padding * 2,

    height:
      maximumY -
      minimumY +
      padding * 2,

    mapX(x) {
      return (
        x -
        minimumX +
        padding
      );
    },

    mapY(y) {
      return (
        y -
        minimumY +
        padding
      );
    },
  };
}

function getTerritoryCenter(
  territory,
) {
  const vertices =
    territory.vertexIds
      .map(
        (vertexId) =>
          game.board.vertices
            .find(
              (vertex) =>
                vertex.id ===
                vertexId,
            ),
      )
      .filter(Boolean);

  return {
    x:
      vertices.reduce(
        (
          total,
          vertex,
        ) =>
          total +
          vertex.x,
        0,
      ) /
      Math.max(
        1,
        vertices.length,
      ),

    y:
      vertices.reduce(
        (
          total,
          vertex,
        ) =>
          total +
          vertex.y,
        0,
      ) /
      Math.max(
        1,
        vertices.length,
      ),
  };
}

function getValidVertexIds() {
  if (
    game.phase ===
    GAME_PHASES
      .SETUP_VILLAGE
  ) {
    return new Set(
      game.getValidInitialVillageIds(),
    );
  }

  if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'village'
  ) {
    return new Set(
      game.getValidVillageIds(),
    );
  }

  if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'city'
  ) {
    return new Set(
      game.board.vertices
        .filter(
          (vertex) =>
            vertex.ownerId ===
              game.currentPlayer.id &&
            vertex.building ===
              'village',
        )
        .map(
          (vertex) =>
            vertex.id,
        ),
    );
  }

  return new Set();
}

function getValidEdgeIds() {
  if (
    game.phase ===
    GAME_PHASES
      .SETUP_ROAD
  ) {
    return new Set(
      game.getValidInitialRoadIds(),
    );
  }

  if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'road'
  ) {
    return new Set(
      game.getValidRoadIds(),
    );
  }

  return new Set();
}

function renderBoardSvg() {
  const geometry =
    computeBoardGeometry();

  const validVertexIds =
    getValidVertexIds();

  const validEdgeIds =
    getValidEdgeIds();

  const territoryMarkup =
    game.board.territories
      .map(
        (
          territory,
        ) => {
          const points =
            territory.vertexIds
              .map(
                (
                  vertexId,
                ) => {
                  const vertex =
                    game.board.vertices
                      .find(
                        (
                          item,
                        ) =>
                          item.id ===
                          vertexId,
                      );

                  return `${
                    geometry.mapX(
                      vertex.x,
                    )
                  },${
                    geometry.mapY(
                      vertex.y,
                    )
                  }`;
                },
              )
              .join(' ');

          const center =
            getTerritoryCenter(
              territory,
            );

          const centerX =
            geometry.mapX(
              center.x,
            );

          const centerY =
            geometry.mapY(
              center.y,
            );

          const resourceId =
            territory.resourceId ||
            territory.resource ||
            'abandoned';

          const resourceClass =
            RESOURCE_CLASSES[
              resourceId
            ] ||
            'resource-abandoned';

          const label =
            resourceId ===
              'abandoned'
              ? 'Terras Ermas'
              : getResourceLabel(
                  resourceId,
                );

          const number =
            territory.number;

          return `
            <g class="territory-group">
              <polygon
                class="
                  territory
                  ${resourceClass}
                  ${
                    game.lastRoll
                      ?.total ===
                    number
                      ? 'is-producing'
                      : ''
                  }
                "
                points="${points}"
              />

              <text
                class="territory-label"
                x="${centerX}"
                y="${centerY - 18}"
                text-anchor="middle"
              >
                ${escapeHtml(
                  label,
                )}
              </text>

              ${
                number
                  ? `
                    <circle
                      class="
                        number-token
                        ${
                          number ===
                            6 ||
                          number ===
                            8
                            ? 'is-strong'
                            : ''
                        }
                      "
                      cx="${centerX}"
                      cy="${centerY + 12}"
                      r="22"
                    />

                    <text
                      class="number-token-text"
                      x="${centerX}"
                      y="${centerY + 19}"
                      text-anchor="middle"
                    >
                      ${number}
                    </text>
                  `
                  : `
                    <text
                      class="territory-empty-mark"
                      x="${centerX}"
                      y="${centerY + 20}"
                      text-anchor="middle"
                    >
                      ✦
                    </text>
                  `
              }
            </g>
          `;
        },
      )
      .join('');

  const edgeMarkup =
    game.board.edges
      .map(
        (
          edge,
        ) => {
          const first =
            game.board.vertices
              .find(
                (vertex) =>
                  vertex.id ===
                  edge.vertexIds[0],
              );

          const second =
            game.board.vertices
              .find(
                (vertex) =>
                  vertex.id ===
                  edge.vertexIds[1],
              );

          const owner =
            game.players.find(
              (player) =>
                player.id ===
                edge.ownerId,
            );

          const isValid =
            validEdgeIds.has(
              edge.id,
            );

          return `
            <line
              class="
                board-edge
                ${
                  edge.segment
                    ? 'has-road'
                    : ''
                }
                ${
                  isValid
                    ? 'is-valid'
                    : ''
                }
              "
              data-edge-id="${edge.id}"
              x1="${
                geometry.mapX(
                  first.x,
                )
              }"
              y1="${
                geometry.mapY(
                  first.y,
                )
              }"
              x2="${
                geometry.mapX(
                  second.x,
                )
              }"
              y2="${
                geometry.mapY(
                  second.y,
                )
              }"
              style="
                --edge-owner-color:
                  ${
                    owner?.color ||
                    '#CBD5E1'
                  };
              "
            />
          `;
        },
      )
      .join('');

  const vertexMarkup =
    game.board.vertices
      .map(
        (
          vertex,
        ) => {
          const owner =
            game.players.find(
              (player) =>
                player.id ===
                vertex.ownerId,
            );

          const isValid =
            validVertexIds.has(
              vertex.id,
            );

          const x =
            geometry.mapX(
              vertex.x,
            );

          const y =
            geometry.mapY(
              vertex.y,
            );

          if (
            vertex.building
          ) {
            const size =
              vertex.building ===
                'city'
                ? 17
                : 13;

            return `
              <g
                class="
                  building
                  building-${vertex.building}
                "
                data-vertex-id="${vertex.id}"
                style="
                  --building-color:
                    ${
                      owner?.color ||
                      '#334155'
                    };
                "
              >
                <rect
                  x="${x - size}"
                  y="${y - size}"
                  width="${size * 2}"
                  height="${size * 2}"
                  rx="4"
                />

                <text
                  x="${x}"
                  y="${y + 5}"
                  text-anchor="middle"
                >
                  ${
                    vertex.building ===
                    'city'
                      ? '♜'
                      : '⌂'
                  }
                </text>
              </g>
            `;
          }

          return `
            <circle
              class="
                board-vertex
                ${
                  isValid
                    ? 'is-valid'
                    : ''
                }
              "
              data-vertex-id="${vertex.id}"
              cx="${x}"
              cy="${y}"
              r="${
                isValid
                  ? 10
                  : 5
              }"
            />
          `;
        },
      )
      .join('');

  return `
    <svg
      class="board-svg"
      viewBox="
        0
        0
        ${geometry.width}
        ${geometry.height}
      "
      role="img"
      aria-label="Tabuleiro do Conquistador"
    >
      <defs>
        <filter
          id="territory-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="4"
            flood-opacity="0.22"
          />
        </filter>
      </defs>

      <g filter="url(#territory-shadow)">
        ${territoryMarkup}
      </g>

      <g class="edge-layer">
        ${edgeMarkup}
      </g>

      <g class="vertex-layer">
        ${vertexMarkup}
      </g>
    </svg>
  `;
}

function renderPlayers() {
  return game.players
    .map(
      (
        player,
      ) => `
        <article
          class="
            player-summary
            ${
              player.id ===
              game.currentPlayer
                ?.id
                ? 'is-active'
                : ''
            }
          "
          style="
            --player-color:
              ${player.color};
          "
        >
          <div class="player-summary-heading">
            <span class="player-symbol">
              ${escapeHtml(
                player.symbol,
              )}
            </span>

            <div>
              <strong>
                ${escapeHtml(
                  player.name,
                )}
              </strong>

              <span>
                ${
                  player.prestige
                } Prestígio
              </span>
            </div>
          </div>

          <div class="player-public-data">
            <span>
              ${
                player.getTotalResources()
              } recursos
            </span>

            <span>
              ${
                player.pieces.villages
              } Vilas
            </span>

            <span>
              ${
                player.pieces.segments
              } Caminhos
            </span>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderCurrentResources() {
  const player =
    game.currentPlayer;

  return RESOURCE_IDS
    .map(
      (
        resourceId,
      ) => `
        <div
          class="
            resource-card
            ${
              RESOURCE_CLASSES[
                resourceId
              ] || ''
            }
          "
        >
          <span class="resource-symbol">
            ${
              RESOURCE_SYMBOLS[
                resourceId
              ] || '●'
            }
          </span>

          <span class="resource-name">
            ${escapeHtml(
              getResourceLabel(
                resourceId,
              ),
            )}
          </span>

          <strong>
            ${
              player.resources[
                resourceId
              ] || 0
            }
          </strong>
        </div>
      `,
    )
    .join('');
}

function renderHistory() {
  const entries =
    game.history
      .slice(-8)
      .reverse();

  if (
    entries.length === 0
  ) {
    return `
      <p class="empty-history">
        A Jornada ainda não começou.
      </p>
    `;
  }

  return entries
    .map(
      (
        entry,
      ) => `
        <li>
          <span>
            ${escapeHtml(
              entry.message,
            )}
          </span>
        </li>
      `,
    )
    .join('');
}

function renderActionButtons() {
  if (
    game.phase ===
    GAME_PHASES
      .SETUP_VILLAGE
  ) {
    return `
      <div class="instruction-card">
        <strong>
          Coloque uma Vila
        </strong>

        <span>
          Selecione um dos vértices destacados.
        </span>
      </div>
    `;
  }

  if (
    game.phase ===
    GAME_PHASES
      .SETUP_ROAD
  ) {
    return `
      <div class="instruction-card">
        <strong>
          Coloque um Caminho
        </strong>

        <span>
          Selecione uma ligação destacada
          junto da Vila.
        </span>
      </div>
    `;
  }

  if (
    game.phase ===
    GAME_PHASES
      .TURN_ROLL
  ) {
    return `
      <button
        id="roll-dice-button"
        class="button button-primary"
        type="button"
      >
        Lançar os dados
      </button>
    `;
  }

  if (
    game.phase ===
    GAME_PHASES
      .TURN_ACTIONS
  ) {
    return `
      <div class="build-actions">
        <button
          class="
            button
            button-build
            ${
              selectedAction ===
                'road'
                ? 'is-active'
                : ''
            }
          "
          data-action="road"
          type="button"
        >
          Caminho
          <small>
            1 Pedra + 1 Cortiça
          </small>
        </button>

        <button
          class="
            button
            button-build
            ${
              selectedAction ===
                'village'
                ? 'is-active'
                : ''
            }
          "
          data-action="village"
          type="button"
        >
          Vila
          <small>
            Pedra, Cortiça, Trigo e Bacalhau
          </small>
        </button>

        <button
          class="
            button
            button-build
            ${
              selectedAction ===
                'city'
                ? 'is-active'
                : ''
            }
          "
          data-action="city"
          type="button"
        >
          Cidade
          <small>
            3 Ferros + 2 Trigos
          </small>
        </button>
      </div>

      <button
        id="end-turn-button"
        class="button button-secondary"
        type="button"
      >
        Concluir Jornada
      </button>
    `;
  }

  return `
    <div class="victory-card">
      <strong>
        ${
          escapeHtml(
            game.winner?.name ||
            'Vencedor',
          )
        }
      </strong>

      <span>
        conquistou o Reino.
      </span>
    </div>
  `;
}

function renderGame() {
  if (!game) {
    renderHome();

    return;
  }

  app.innerHTML = `
    <main class="game-screen">
      <header class="game-header">
        <div>
          <p class="eyebrow">
            Terras e Rotas do Atlântico
          </p>

          <h1>
            Conquistador
          </h1>
        </div>

        <div class="game-header-actions">
          <button
            id="save-button"
            class="button button-quiet"
            type="button"
          >
            Guardar
          </button>

          <button
            id="leave-game-button"
            class="button button-quiet"
            type="button"
          >
            Menu
          </button>
        </div>
      </header>

      <section class="turn-banner">
        <div
          class="turn-player-symbol"
          style="
            --player-color:
              ${game.currentPlayer.color};
          "
        >
          ${escapeHtml(
            game.currentPlayer.symbol,
          )}
        </div>

        <div>
          <span>
            Vez de
          </span>

          <strong>
            ${escapeHtml(
              game.currentPlayer.name,
            )}
          </strong>

          <small>
            ${escapeHtml(
              getPhaseLabel(),
            )}
          </small>
        </div>

        ${
          game.lastRoll
            ? `
              <div class="dice-result">
                <span>
                  ${
                    game.lastRoll.die1
                  }
                </span>

                <span>
                  ${
                    game.lastRoll.die2
                  }
                </span>

                <strong>
                  ${
                    game.lastRoll.total
                  }
                </strong>
              </div>
            `
            : ''
        }
      </section>

      <div
        id="status-message"
        class="status-message"
      ></div>

      <section class="game-layout">
        <aside class="game-sidebar game-sidebar-left">
          <section class="panel">
            <div class="panel-heading">
              <h2>
                Casas
              </h2>
            </div>

            <div class="players-list">
              ${renderPlayers()}
            </div>
          </section>

          <section class="panel">
            <div class="panel-heading">
              <h2>
                Histórico
              </h2>
            </div>

            <ol class="history-list">
              ${renderHistory()}
            </ol>
          </section>
        </aside>

        <section class="board-panel">
          <div class="board-frame">
            ${renderBoardSvg()}
          </div>
        </section>

        <aside class="game-sidebar game-sidebar-right">
          <section class="panel private-panel">
            <div class="panel-heading">
              <h2>
                Recursos
              </h2>

              <span>
                ${
                  escapeHtml(
                    game.currentPlayer.name,
                  )
                }
              </span>
            </div>

            <div class="resources-grid">
              ${renderCurrentResources()}
            </div>
          </section>

          <section class="panel action-panel">
            <div class="panel-heading">
              <h2>
                Ações
              </h2>
            </div>

            <div class="action-buttons">
              ${renderActionButtons()}
            </div>
          </section>

          <section class="panel">
            <div class="panel-heading">
              <h2>
                Reserva da Coroa
              </h2>
            </div>

            <div class="bank-list">
              ${RESOURCE_IDS
                .map(
                  (
                    resourceId,
                  ) => `
                    <span>
                      ${escapeHtml(
                        getResourceLabel(
                          resourceId,
                        ),
                      )}

                      <strong>
                        ${
                          game.bank
                            .snapshot()[
                            resourceId
                          ]
                        }
                      </strong>
                    </span>
                  `,
                )
                .join('')}
            </div>
          </section>
        </aside>
      </section>
    </main>
  `;

  renderStatus();

  attachGameEvents();
}

function handleVertexClick(
  vertexId,
) {
  let result = null;

  if (
    game.phase ===
    GAME_PHASES
      .SETUP_VILLAGE
  ) {
    result =
      game.placeInitialVillage(
        vertexId,
      );
  } else if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'village'
  ) {
    result =
      game.buildVillage(
        vertexId,
      );
  } else if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'city'
  ) {
    result =
      game.buildCity(
        vertexId,
      );
  } else {
    return;
  }

  if (
    !result.success
  ) {
    setStatus(
      result.reason,
      'error',
    );

    return;
  }

  selectedAction =
    null;

  saveGame();

  renderGame();

  if (
    game.phase ===
    GAME_PHASES
      .SETUP_ROAD
  ) {
    setStatus(
      'Agora selecione um Caminho ligado à Vila.',
      'success',
    );
  } else {
    setStatus(
      'Construção concluída.',
      'success',
    );
  }
}

function handleEdgeClick(
  edgeId,
) {
  let result = null;

  if (
    game.phase ===
    GAME_PHASES
      .SETUP_ROAD
  ) {
    result =
      game.placeInitialRoad(
        edgeId,
      );
  } else if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'road'
  ) {
    result =
      game.buildRoad(
        edgeId,
      );
  } else {
    return;
  }

  if (
    !result.success
  ) {
    setStatus(
      result.reason,
      'error',
    );

    return;
  }

  selectedAction =
    null;

  saveGame();

  renderGame();

  if (
    game.phase ===
    GAME_PHASES
      .SETUP_VILLAGE
  ) {
    setStatus(
      `${game.currentPlayer.name}: selecione um local para a sua Vila.`,
      'success',
    );
  } else if (
    game.phase ===
    GAME_PHASES
      .TURN_ROLL
  ) {
    setStatus(
      'A preparação terminou. Lance os dados.',
      'success',
    );
  } else {
    setStatus(
      'Caminho construído.',
      'success',
    );
  }
}

function attachGameEvents() {
  document
    .querySelectorAll(
      '[data-vertex-id]',
    )
    .forEach(
      (element) => {
        element.addEventListener(
          'click',
          () => {
            handleVertexClick(
              element.dataset
                .vertexId,
            );
          },
        );
      },
    );

  document
    .querySelectorAll(
      '[data-edge-id]',
    )
    .forEach(
      (element) => {
        element.addEventListener(
          'click',
          () => {
            handleEdgeClick(
              element.dataset
                .edgeId,
            );
          },
        );
      },
    );

  document
    .querySelectorAll(
      '[data-action]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            setAction(
              button.dataset
                .action,
            );
          },
        );
      },
    );

  document
    .querySelector(
      '#roll-dice-button',
    )
    ?.addEventListener(
      'click',
      () => {
        const result =
          game.rollDice();

        if (
          !result.success
        ) {
          setStatus(
            result.reason,
            'error',
          );

          return;
        }

        saveGame();

        renderGame();

        setStatus(
          result.roll.total ===
            7
            ? 'Foi lançado 7. O evento especial ainda será implementado.'
            : `Resultado ${result.roll.total}: produção distribuída.`,
          result.roll.total ===
            7
            ? 'warning'
            : 'success',
        );
      },
    );

  document
    .querySelector(
      '#end-turn-button',
    )
    ?.addEventListener(
      'click',
      () => {
        const result =
          game.endTurn();

        if (
          !result.success
        ) {
          setStatus(
            result.reason,
            'error',
          );

          return;
        }

        selectedAction =
          null;

        saveGame();

        renderGame();

        setStatus(
          `É agora a vez de ${game.currentPlayer.name}.`,
          'info',
        );
      },
    );

  document
    .querySelector(
      '#save-button',
    )
    ?.addEventListener(
      'click',
      () => {
        const result =
          saveManager.save(
            game,
          );

        setStatus(
          result.success
            ? 'Partida guardada neste dispositivo.'
            : result.reason,
          result.success
            ? 'success'
            : 'error',
        );
      },
    );

  document
    .querySelector(
      '#leave-game-button',
    )
    ?.addEventListener(
      'click',
      () => {
        saveGame();

        renderHome();
      },
    );
}

renderHome();
