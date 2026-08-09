import {
  Game,
  GAME_PHASES,
  HOUSE_PRESETS,
} from './game/Game.js';

import {
  BUILD_COSTS,
} from './game/RulesEngine.js';

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

let selectedAction =
  null;

let statusMessage =
  '';

let statusType =
  'info';

let sevenDiscardDraft =
  {};

let sevenDiscardPlayerId =
  null;

const RESOURCE_VISUALS =
  Object.freeze({
    cork:
      Object.freeze({
        label: 'Cortiça',
        icon: '◉',
        fill:
          'url(#tile-cork)',
      }),

    stone:
      Object.freeze({
        label: 'Pedra',
        icon: '▰',
        fill:
          'url(#tile-stone)',
      }),

    wheat:
      Object.freeze({
        label: 'Trigo',
        icon: '♨',
        fill:
          'url(#tile-wheat)',
      }),

    cod:
      Object.freeze({
        label: 'Bacalhau',
        icon: '≈',
        fill:
          'url(#tile-cod)',
      }),

    iron:
      Object.freeze({
        label: 'Ferro',
        icon: '◆',
        fill:
          'url(#tile-iron)',
      }),

    abandoned:
      Object.freeze({
        label:
          'Terras Ermas',

        icon: '✦',

        fill:
          'url(#tile-abandoned)',
      }),
  });

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

function getResource(
  resourceId,
) {
  return (
    RESOURCES[
      resourceId
    ] || {
      id:
        resourceId,

      name:
        RESOURCE_VISUALS[
          resourceId
        ]?.label ||
        resourceId,

      shortName:
        RESOURCE_VISUALS[
          resourceId
        ]?.label ||
        resourceId,

      icon:
        RESOURCE_VISUALS[
          resourceId
        ]?.icon ||
        '●',
    }
  );
}

function getPhaseLabel() {
  const labels = {
    [GAME_PHASES.SETUP_VILLAGE]:
      'Fundar Vila inicial',

    [GAME_PHASES.SETUP_ROAD]:
      'Traçar ligação inicial',

    [GAME_PHASES.TURN_ROLL]:
      'Lançar os dados',

    [GAME_PHASES.TURN_ACTIONS]:
      'Construir ou concluir a Jornada',

    [GAME_PHASES.GAME_OVER]:
      'Partida terminada',
  };

  return (
    labels[
      game?.phase
    ] || ''
  );
}

function saveGame({
  silent = true,
} = {}) {
  if (!game) {
    return false;
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

    return false;
  }

  if (!silent) {
    setStatus(
      'Partida guardada neste dispositivo.',
      'success',
    );
  }

  return true;
}

function createPlayerFields(
  count,
) {
  return Array.from(
    {
      length:
        count,
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
            style="--player-color:${house.color}"
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
  selectedAction =
    null;

  app.innerHTML = `
    <main class="home-screen">
      <section class="hero-panel">
        <div
          class="hero-azulejo hero-azulejo-left"
          aria-hidden="true"
        ></div>

        <div
          class="hero-azulejo hero-azulejo-right"
          aria-hidden="true"
        ></div>

        <div
          class="hero-compass"
          aria-hidden="true"
        >
          <span>✦</span>
        </div>

        <p class="eyebrow">
          Terras e Rotas do Atlântico
        </p>

        <h1>
          Conquistador
        </h1>

        <p class="hero-description">
          Faça crescer a influência da sua Casa,
          funde povoações e construa uma rede
          através de um território inspirado
          em Portugal Continental.
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

        <div class="hero-version">
          <span>
            Mapa Portugal Continental
          </span>

          <span>•</span>

          <span>
            Núcleo jogável
          </span>
        </div>
      </section>
    </main>
  `;

  document
    .querySelector(
      '#new-game-button',
    )
    ?.addEventListener(
      'click',
      () =>
        renderNewGame(),
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

          renderHome();

          return;
        }

        game =
          result.game;

        selectedAction =
          null;

        statusMessage =
          'Partida retomada.';

        statusType =
          'success';

        renderGame();
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

        <div class="setup-heading">
          <p class="eyebrow">
            Preparar expedição
          </p>

          <h1>
            Nova partida
          </h1>

          <p>
            Escolha os jogadores. O território
            e os marcadores serão gerados
            a partir da seed.
          </p>
        </div>

        <form id="new-game-form">
          <fieldset class="player-count-fieldset">
            <legend>
              Número de jogadores
            </legend>

            <div class="segmented-control">
              ${[
                2,
                3,
                4,
              ]
                .map(
                  (
                    count,
                  ) => `
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
              Seed do território
            </span>

            <input
              type="text"
              name="seed"
              value="CONQ-${Date.now()}"
              maxlength="80"
            />

            <small>
              A mesma seed gera exatamente
              o mesmo território.
            </small>
          </label>

          <button
            class="button button-primary button-large setup-submit"
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
          () =>
            renderNewGame(
              Number(
                button
                  .dataset
                  .playerCount,
              ),
            ),
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

              const rawName =
                String(
                  formData.get(
                    `player-${index}`,
                  ) || '',
                ).trim();

              return {
                id:
                  `player-${index + 1}`,

                name:
                  rawName ||
                  `Jogador ${index + 1}`,

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

          statusMessage =
            `${game.currentPlayer.name}: selecione um local destacado para a primeira Vila.`;

          statusType =
            'info';

          saveGame();

          renderGame();
        } catch (
          error
        ) {
          const message =
            error instanceof
            Error
              ? error.message
              : 'Não foi possível iniciar a partida.';

          alert(
            message,
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

  const padding = {
    left: 180,
    right: 110,
    top: 100,
    bottom: 110,
  };

  return {
    minimumX,
    minimumY,

    width:
      maximumX -
      minimumX +
      padding.left +
      padding.right,

    height:
      maximumY -
      minimumY +
      padding.top +
      padding.bottom,

    mapX(x) {
      return (
        x -
        minimumX +
        padding.left
      );
    },

    mapY(y) {
      return (
        y -
        minimumY +
        padding.top
      );
    },
  };
}

function getTerritoryCenter(
  territory,
) {
  if (
    territory.center
  ) {
    return territory.center;
  }

  const vertices =
    territory
      .vertexIds
      .map(
        (
          vertexId,
        ) =>
          game.board
            .vertices
            .find(
              (
                vertex,
              ) =>
                vertex.id ===
                vertexId,
            ),
      )
      .filter(
        Boolean,
      );

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
      game
        .getValidInitialVillageIds(),
    );
  }

  if (
    game.phase !==
    GAME_PHASES
      .TURN_ACTIONS
  ) {
    return new Set();
  }

  if (
    selectedAction ===
    'village'
  ) {
    return new Set(
      game
        .getValidVillageIds(),
    );
  }

  if (
    selectedAction ===
    'city'
  ) {
    return new Set(
      game
        .getValidCityIds(),
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
    return new Set([
      ...game
        .getValidInitialRoadIds(),
      ...game
        .getValidInitialSeaRouteIds(),
    ]);
  }

  if (
    game.phase ===
      GAME_PHASES
        .EVENT_SEVEN &&
    game.sevenEvent
      ?.step ===
      'choose-target' &&
    game.sevenEvent
      ?.selectedThreat ===
      'storm'
  ) {
    return new Set(
      game.getSevenValidEdgeIds(),
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

  if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'sea-route'
  ) {
    return new Set(
      game.getValidSeaRouteIds(),
    );
  }

  return new Set();
}

function getValidThreatTerritoryIds() {
  if (
    game.phase !==
      GAME_PHASES
        .EVENT_SEVEN ||
    game.sevenEvent
      ?.step !==
      'choose-target'
  ) {
    return new Set();
  }

  return new Set(
    game.getSevenValidTerritoryIds(),
  );
}

function svgDefs() {
  return `
    <defs>
      <pattern
        id="tile-cork"
        width="24"
        height="24"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="24"
          height="24"
          fill="#a96d3d"
        />

        <circle
          cx="6"
          cy="7"
          r="2.2"
          fill="#d69b66"
          opacity=".55"
        />

        <circle
          cx="18"
          cy="17"
          r="2.8"
          fill="#7e4828"
          opacity=".32"
        />

        <path
          d="M0 22L22 0M10 24L24 10"
          stroke="#f0c295"
          stroke-width="1"
          opacity=".18"
        />
      </pattern>

      <pattern
        id="tile-stone"
        width="28"
        height="24"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="28"
          height="24"
          fill="#9f9b91"
        />

        <path
          d="M0 8H12L16 2H28M0 19H8L13 13H28"
          stroke="#d6d2c8"
          stroke-width="1.4"
          opacity=".46"
        />

        <path
          d="M6 0L3 8M20 8L17 17"
          stroke="#716f69"
          stroke-width="1"
          opacity=".3"
        />
      </pattern>

      <pattern
        id="tile-wheat"
        width="22"
        height="28"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="22"
          height="28"
          fill="#d7b34f"
        />

        <path
          d="M11 28V2M11 8L6 4M11 13L16 8M11 18L6 13M11 23L17 17"
          stroke="#f7dfa0"
          stroke-width="2"
          opacity=".62"
        />
      </pattern>

      <pattern
        id="tile-cod"
        width="32"
        height="20"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="32"
          height="20"
          fill="#5c9cb2"
        />

        <path
          d="M-4 7Q4 1 12 7T28 7T44 7M-4 16Q4 10 12 16T28 16T44 16"
          fill="none"
          stroke="#bce0e8"
          stroke-width="1.7"
          opacity=".55"
        />
      </pattern>

      <pattern
        id="tile-iron"
        width="24"
        height="24"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(25)"
      >
        <rect
          width="24"
          height="24"
          fill="#657687"
        />

        <path
          d="M0 4H24M0 14H24"
          stroke="#a8b5bf"
          stroke-width="2"
          opacity=".28"
        />

        <path
          d="M0 9H24M0 19H24"
          stroke="#334554"
          stroke-width="1"
          opacity=".25"
        />
      </pattern>

      <pattern
        id="tile-abandoned"
        width="26"
        height="26"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="26"
          height="26"
          fill="#8b7d6e"
        />

        <path
          d="M0 0L26 26M26 0L0 26"
          stroke="#c7b8a4"
          stroke-width="1"
          opacity=".18"
        />
      </pattern>

      <filter
        id="territory-shadow"
        x="-30%"
        y="-30%"
        width="160%"
        height="160%"
      >
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="4"
          flood-color="#062737"
          flood-opacity=".34"
        />
      </filter>

      <filter
        id="glow"
        x="-60%"
        y="-60%"
        width="220%"
        height="220%"
      >
        <feGaussianBlur
          stdDeviation="4"
          result="blur"
        />

        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  `;
}

function renderBoardSvg() {
  const geometry =
    computeBoardGeometry();

  const validVertexIds =
    getValidVertexIds();

  const validEdgeIds =
    getValidEdgeIds();

  const validThreatTerritoryIds =
    getValidThreatTerritoryIds();

  const territoryMarkup =
    game.board
      .territories
      .map(
        (
          territory,
        ) => {
          const points =
            territory
              .vertexIds
              .map(
                (
                  vertexId,
                ) => {
                  const vertex =
                    game.board
                      .vertices
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

          const visual =
            RESOURCE_VISUALS[
              territory.resourceId
            ] ||
            RESOURCE_VISUALS
              .abandoned;

          const number =
            territory.number;

          const isProducing =
            game.lastRoll
              ?.total ===
              number &&
            !territory.blocked;

          const isThreatTarget =
            validThreatTerritoryIds
              .has(
                territory.id,
              );

          const isActiveThreat =
            game.threat
              ?.targetType ===
              'territory' &&
            game.threat
              ?.targetId ===
              territory.id;

          return `
            <g
              class="
                territory-group
                ${
                  isProducing
                    ? 'is-producing'
                    : ''
                }
              "
            >
              <polygon
                class="territory"
                data-territory-id="${territory.id}"
                points="${points}"
                fill="${visual.fill}"
                stroke="${
                  isThreatTarget ||
                  isProducing
                    ? '#fff0a8'
                    : '#f4e6bd'
                }"
                stroke-width="${
                  isThreatTarget
                    ? 7
                    : isProducing
                      ? 5
                      : 3
                }"
                filter="url(#territory-shadow)"
                style="${
                  isThreatTarget
                    ? 'cursor:pointer'
                    : ''
                }"
              />

              <text
                class="territory-icon"
                x="${centerX}"
                y="${centerY - 23}"
                text-anchor="middle"
              >
                ${escapeHtml(
                  visual.icon,
                )}
              </text>

              <text
                class="territory-label"
                x="${centerX}"
                y="${centerY - 4}"
                text-anchor="middle"
              >
                ${escapeHtml(
                  visual.label,
                )}
              </text>

              ${
                number
                  ? `
                    <circle
                      class="
                        number-token
                        ${
                          [
                            6,
                            8,
                          ].includes(
                            number,
                          )
                            ? 'is-strong'
                            : ''
                        }
                      "
                      cx="${centerX}"
                      cy="${centerY + 25}"
                      r="20"
                    />

                    <text
                      class="number-token-text"
                      x="${centerX}"
                      y="${centerY + 32}"
                      text-anchor="middle"
                    >
                      ${number}
                    </text>
                  `
                  : `
                    <text
                      class="territory-empty-mark"
                      x="${centerX}"
                      y="${centerY + 31}"
                      text-anchor="middle"
                    >
                      ✦
                    </text>
                  `
              }

              ${
                isActiveThreat
                  ? `
                    <circle
                      cx="${centerX + 31}"
                      cy="${centerY - 32}"
                      r="15"
                      fill="${
                        game.threat.type ===
                        'storm'
                          ? '#6f8795'
                          : '#584334'
                      }"
                      stroke="#fff0a8"
                      stroke-width="2.5"
                    />

                    <text
                      x="${centerX + 31}"
                      y="${centerY - 26}"
                      text-anchor="middle"
                      fill="#fffaf0"
                      font-size="16"
                      font-weight="800"
                    >
                      ${
                        game.threat.type ===
                        'storm'
                          ? '⚡'
                          : '☠'
                      }
                    </text>
                  `
                  : ''
              }
            </g>
          `;
        },
      )
      .join('');

  const edgeMarkup =
    game.board
      .edges
      .map(
        (
          edge,
        ) => {
          const first =
            game.board
              .vertices
              .find(
                (
                  vertex,
                ) =>
                  vertex.id ===
                  edge.vertexIds[
                    0
                  ],
              );

          const second =
            game.board
              .vertices
              .find(
                (
                  vertex,
                ) =>
                  vertex.id ===
                  edge.vertexIds[
                    1
                  ],
              );

          const owner =
            game.players
              .find(
                (
                  player,
                ) =>
                  player.id ===
                  edge.ownerId,
              );

          const isValid =
            validEdgeIds.has(
              edge.id,
            );

          const color =
            owner?.color ||
            '#f8e9bf';

          const isActiveStormEdge =
            game.threat
              ?.type ===
              'storm' &&
            game.threat
              ?.targetType ===
              'edge' &&
            game.threat
              ?.targetId ===
              edge.id;

          const midpointX =
            (
              geometry.mapX(
                first.x,
              ) +
              geometry.mapX(
                second.x,
              )
            ) / 2;

          const midpointY =
            (
              geometry.mapY(
                first.y,
              ) +
              geometry.mapY(
                second.y,
              )
            ) / 2;

          return `
            <line
              class="
                board-edge
                ${
                  edge.segment ===
                    'sea-route'
                    ? 'has-sea-route'
                    : edge.segment ===
                        'road'
                      ? 'has-road'
                      : ''
                }
                ${
                  isValid
                    ? 'is-valid'
                    : ''
                }
                ${
                  edge.stormBlocked
                    ? 'is-storm-blocked'
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
              stroke="${
                edge.segment
                  ? color
                  : isValid
                    ? '#fff0a8'
                    : 'rgba(255,255,255,.08)'
              }"
              stroke-width="${
                edge.segment ===
                  'sea-route'
                  ? 8
                  : edge.segment
                    ? 11
                    : isValid
                      ? 13
                      : 4
              }"
              stroke-dasharray="${
                edge.segment ===
                  'sea-route'
                  ? '13 7'
                  : 'none'
              }"
              stroke-linecap="round"
            />

            ${
              isActiveStormEdge
                ? `
                  <g
                    transform="translate(${midpointX} ${midpointY})"
                    pointer-events="none"
                  >
                    <circle
                      r="14"
                      fill="#6f8795"
                      stroke="#fff0a8"
                      stroke-width="2.5"
                    />
                    <text
                      x="0"
                      y="6"
                      text-anchor="middle"
                      fill="#fffaf0"
                      font-size="16"
                      font-weight="800"
                    >
                      ⚡
                    </text>
                  </g>
                `
                : ''
            }
          `;
        },
      )
      .join('');

  const vertexMarkup =
    game.board
      .vertices
      .map(
        (
          vertex,
        ) => {
          const owner =
            game.players
              .find(
                (
                  player,
                ) =>
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
            const isCity =
              vertex.building ===
              'city';

            const size =
              isCity
                ? 16
                : 12;

            return `
              <g
                class="
                  building
                  building-${vertex.building}
                  ${
                    isValid
                      ? 'is-valid'
                      : ''
                  }
                "
                data-vertex-id="${vertex.id}"
                transform="translate(${x} ${y})"
              >
                <path
                  d="
                    M${-size} ${size * 0.55}
                    V${-size * 0.25}
                    L0 ${-size}
                    L${size} ${-size * 0.25}
                    V${size * 0.55}
                    Z
                  "
                  fill="${
                    owner?.color ||
                    '#334155'
                  }"
                  stroke="${
                    isValid
                      ? '#fff0a8'
                      : '#fffaf0'
                  }"
                  stroke-width="${
                    isCity
                      ? 4
                      : 3
                  }"
                />

                ${
                  isCity
                    ? `
                      <path
                        d="
                          M${-size * 0.55} ${-size * 0.25}
                          V${-size * 0.7}
                          H${-size * 0.15}
                          V${-size * 0.25}

                          M${size * 0.15} ${-size * 0.25}
                          V${-size * 0.7}
                          H${size * 0.7}
                          V${-size * 0.25}
                        "
                        stroke="#fffaf0"
                        stroke-width="2.2"
                        fill="none"
                      />
                    `
                    : ''
                }
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
                  : 4
              }"
              fill="${
                isValid
                  ? '#fff0a8'
                  : 'rgba(255,255,255,.35)'
              }"
              stroke="${
                isValid
                  ? '#ffffff'
                  : 'rgba(8,45,60,.5)'
              }"
              stroke-width="${
                isValid
                  ? 3
                  : 1.5
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
      aria-label="Tabuleiro do Conquistador inspirado em Portugal Continental"
    >
      ${svgDefs()}

      <g
        class="map-decoration"
        aria-hidden="true"
      >
        <text
          x="62"
          y="${geometry.height * 0.46}"
          class="atlantic-label"
          transform="
            rotate(
              -90
              62
              ${geometry.height * 0.46}
            )
          "
        >
          OCEANO ATLÂNTICO
        </text>

        <g
          transform="
            translate(
              ${geometry.width - 75}
              72
            )
          "
        >
          <circle
            r="28"
            fill="none"
            stroke="#d8c284"
            stroke-width="1.3"
            opacity=".75"
          />

          <path
            d="M0 -25L7 -5L0 0L-7 -5Z"
            fill="#d8c284"
          />

          <path
            d="M0 25L6 6L0 1L-6 6Z"
            fill="#d8c284"
            opacity=".55"
          />

          <text
            x="0"
            y="-34"
            text-anchor="middle"
            class="north-label"
          >
            N
          </text>
        </g>
      </g>

      <g class="territory-layer">
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
            ${player.color}
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
                ${player.prestige}
                Prestígio
              </span>
            </div>
          </div>

          <div class="player-public-data">
            <span>
              ${player.getTotalResources()}
              cartas
            </span>

            <span>
              ${player.pieces.villages}
              Vilas
            </span>

            <span>
              ${player.pieces.segments}
              segmentos
            </span>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderCurrentResources() {
  const player =
    game.getCurrentSevenDiscardPlayer?.() ||
    game.currentPlayer;

  return RESOURCE_IDS
    .map(
      (
        resourceId,
      ) => {
        const resource =
          getResource(
            resourceId,
          );

        return `
          <div
            class="
              resource-card
              resource-card-${resourceId}
            "
          >
            <span class="resource-symbol">
              ${escapeHtml(
                resource.icon,
              )}
            </span>

            <span class="resource-name">
              ${escapeHtml(
                resource.shortName ||
                resource.name,
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
        `;
      },
    )
    .join('');
}

function renderHistory() {
  const entries =
    game.history
      .slice(-9)
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

function formatCost(
  cost,
) {
  return Object.entries(
    cost,
  )
    .map(
      ([
        resourceId,
        quantity,
      ]) =>
        `${
          quantity
        } ${
          getResource(
            resourceId,
          ).shortName
        }`,
    )
    .join(' · ');
}

function ensureSevenDiscardDraft() {
  const entry =
    game.getCurrentSevenDiscardEntry?.();

  const player =
    game.getCurrentSevenDiscardPlayer?.();

  if (!entry || !player) {
    sevenDiscardDraft = {};
    sevenDiscardPlayerId = null;
    return null;
  }

  if (
    sevenDiscardPlayerId !==
    player.id
  ) {
    sevenDiscardPlayerId =
      player.id;

    sevenDiscardDraft =
      Object.fromEntries(
        RESOURCE_IDS.map(
          (resourceId) => [
            resourceId,
            0,
          ],
        ),
      );
  }

  return {
    entry,
    player,
  };
}

function sevenDiscardTotal() {
  return Object.values(
    sevenDiscardDraft,
  ).reduce(
    (
      total,
      quantity,
    ) =>
      total +
      Number(quantity || 0),
    0,
  );
}

function renderSevenDiscardControls() {
  const state =
    ensureSevenDiscardDraft();

  if (!state) {
    return '';
  }

  const {
    entry,
    player,
  } = state;

  const selectedTotal =
    sevenDiscardTotal();

  return `
    <div class="instruction-card">
      <strong>
        ${escapeHtml(
          player.name,
        )}: descarte ${entry.required}
      </strong>

      <span>
        Tem ${player.getTotalResources()} recursos.
        Escolha exatamente metade, arredondada para baixo.
      </span>
    </div>

    <div class="build-actions">
      ${RESOURCE_IDS
        .map(
          (
            resourceId,
          ) => {
            const resource =
              getResource(
                resourceId,
              );

            const available =
              player.getResource(
                resourceId,
              );

            const selected =
              sevenDiscardDraft[
                resourceId
              ] || 0;

            return `
              <label
                class="button button-build"
              >
                <span>
                  ${escapeHtml(
                    resource.shortName ||
                    resource.name,
                  )}
                </span>

                <small>
                  tem ${available}
                </small>

                <select
                  data-seven-discard-resource="${resourceId}"
                  aria-label="Descartar ${escapeHtml(
                    resource.shortName ||
                    resource.name,
                  )}"
                >
                  ${Array.from(
                    {
                      length:
                        available + 1,
                    },
                    (
                      _,
                      quantity,
                    ) => `
                      <option
                        value="${quantity}"
                        ${
                          quantity ===
                          selected
                            ? 'selected'
                            : ''
                        }
                      >
                        ${quantity}
                      </option>
                    `,
                  ).join('')}
                </select>
              </label>
            `;
          },
        )
        .join('')}
    </div>

    <button
      id="confirm-seven-discard"
      class="button button-primary action-main"
      type="button"
      ${
        selectedTotal ===
        entry.required
          ? ''
          : 'disabled'
      }
    >
      Confirmar descarte
      (${selectedTotal}/${entry.required})
    </button>
  `;
}

function renderSevenEventActions() {
  const event =
    game.sevenEvent;

  if (!event) {
    return '';
  }

  if (
    event.step ===
    'discard'
  ) {
    return renderSevenDiscardControls();
  }

  if (
    event.step ===
    'choose-threat'
  ) {
    return `
      <div class="instruction-card">
        <strong>
          Evento 7
        </strong>

        <span>
          Escolha qual ameaça vai mover.
          Apenas uma pode ficar ativa.
        </span>
      </div>

      <div class="build-actions">
        <button
          class="button button-build"
          data-seven-threat="contrabandist"
          type="button"
        >
          <span>
            Contrabandista
          </span>
          <small>
            Bloquear território · roubar 1 recurso
          </small>
        </button>

        <button
          class="button button-build"
          data-seven-threat="storm"
          type="button"
        >
          <span>
            Tempestade Atlântica
          </span>
          <small>
            Região costeira ou ligação marítima
          </small>
        </button>
      </div>
    `;
  }

  if (
    event.step ===
    'choose-target'
  ) {
    const storm =
      event.selectedThreat ===
      'storm';

    return `
      <div class="instruction-card">
        <strong>
          ${
            storm
              ? 'Mover Tempestade Atlântica'
              : 'Mover Contrabandista'
          }
        </strong>

        <span>
          ${
            storm
              ? 'Escolha uma região costeira dourada ou uma ligação marítima dourada.'
              : 'Escolha um território dourado diferente do atual.'
          }
        </span>
      </div>
    `;
  }

  if (
    event.step ===
    'choose-victim'
  ) {
    const victimIds =
      game.getSevenEligibleVictimIds();

    return `
      <div class="instruction-card">
        <strong>
          Escolher adversário
        </strong>

        <span>
          O recurso retirado será escolhido aleatoriamente.
        </span>
      </div>

      <div class="build-actions">
        ${victimIds
          .map(
            (
              playerId,
            ) => {
              const player =
                game.players.find(
                  (candidate) =>
                    candidate.id ===
                    playerId,
                );

              if (!player) {
                return '';
              }

              return `
                <button
                  class="button button-build"
                  data-seven-victim="${player.id}"
                  type="button"
                >
                  <span>
                    ${escapeHtml(
                      player.name,
                    )}
                  </span>
                  <small>
                    ${player.getTotalResources()} recursos
                  </small>
                </button>
              `;
            },
          )
          .join('')}
      </div>

      ${
        event.selectedThreat ===
        'storm'
          ? `
            <button
              id="skip-seven-theft"
              class="button button-secondary action-main"
              type="button"
            >
              Não retirar carga
            </button>
          `
          : ''
      }
    `;
  }

  return '';
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
          Fundar Vila
        </strong>

        <span>
          Escolha um dos vértices dourados.
          A regra de distância já está ativa.
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
          Traçar ligação
        </strong>

        <span>
          Escolha uma ligação dourada junto da Vila.
          Em terra será um Caminho Real; na costa,
          uma Rota Marítima.
        </span>
      </div>
    `;
  }

  if (
    game.phase ===
    GAME_PHASES
      .EVENT_SEVEN
  ) {
    return renderSevenEventActions();
  }

  if (
    game.phase ===
    GAME_PHASES
      .TURN_ROLL
  ) {
    return `
      <button
        id="roll-dice-button"
        class="button button-primary action-main"
        type="button"
      >
        <span class="dice-icon">
          ⚄
        </span>

        Lançar dois dados
      </button>
    `;
  }

  if (
    game.phase ===
    GAME_PHASES
      .TURN_ACTIONS
  ) {
    const player =
      game.currentPlayer;

    const roadDisabled =
      !player.canAfford(
        BUILD_COSTS.road,
      ) ||
      !player.hasPiece(
        'segments',
      );

    const seaRouteDisabled =
      !player.canAfford(
        BUILD_COSTS.seaRoute,
      ) ||
      !player.hasPiece(
        'segments',
      );

    const villageDisabled =
      !player.canAfford(
        BUILD_COSTS.village,
      ) ||
      !player.hasPiece(
        'villages',
      );

    const cityDisabled =
      !player.canAfford(
        BUILD_COSTS.city,
      ) ||
      !player.hasPiece(
        'cities',
      );

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
          ${
            roadDisabled
              ? 'disabled'
              : ''
          }
        >
          <span>
            Caminho Real
          </span>

          <small>
            ${escapeHtml(
              formatCost(
                BUILD_COSTS.road,
              ),
            )}
          </small>
        </button>

        <button
          class="
            button
            button-build
            ${
              selectedAction ===
              'sea-route'
                ? 'is-active'
                : ''
            }
          "
          data-action="sea-route"
          type="button"
          ${
            seaRouteDisabled
              ? 'disabled'
              : ''
          }
        >
          <span>
            Rota Marítima
          </span>

          <small>
            ${escapeHtml(
              formatCost(
                BUILD_COSTS.seaRoute,
              ),
            )}
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
          ${
            villageDisabled
              ? 'disabled'
              : ''
          }
        >
          <span>
            Vila
          </span>

          <small>
            ${escapeHtml(
              formatCost(
                BUILD_COSTS.village,
              ),
            )}
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
          ${
            cityDisabled
              ? 'disabled'
              : ''
          }
        >
          <span>
            Cidade Muralhada
          </span>

          <small>
            ${escapeHtml(
              formatCost(
                BUILD_COSTS.city,
              ),
            )}
          </small>
        </button>
      </div>

      <button
        id="end-turn-button"
        class="button button-secondary action-main"
        type="button"
      >
        Concluir Jornada
      </button>
    `;
  }

  return `
    <div class="victory-card">
      <strong>
        ${escapeHtml(
          game.winner
            ?.name ||
          'Vencedor',
        )}
      </strong>

      <span>
        alcançou ${
          game.winner
            ?.prestige ||
          12
        } pontos de Prestígio.
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
        <div class="game-brand">
          <p class="eyebrow">
            Terras e Rotas do Atlântico
          </p>

          <h1>
            Conquistador
          </h1>
        </div>

        <div class="game-meta">
          <span>
            Portugal Continental
          </span>

          <span>
            Seed
            ${escapeHtml(
              game.seed,
            )}
          </span>

          <span>
            Jornada
            ${game.turnNumber}
          </span>
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

      <section
        class="turn-banner"
        style="
          --player-color:
          ${game.currentPlayer.color}
        "
      >
        <div class="turn-player-symbol">
          ${escapeHtml(
            game.currentPlayer
              .symbol,
          )}
        </div>

        <div class="turn-copy">
          <span>
            Vez de
          </span>

          <strong>
            ${escapeHtml(
              game.currentPlayer
                .name,
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
              <div
                class="dice-result"
                aria-label="Resultado dos dados ${game.lastRoll.total}"
              >
                <span>
                  ${game.lastRoll.die1}
                </span>

                <span>
                  ${game.lastRoll.die2}
                </span>

                <strong>
                  ${game.lastRoll.total}
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

          <section class="panel history-panel">
            <div class="panel-heading">
              <h2>
                Crónica da Jornada
              </h2>
            </div>

            <ol class="history-list">
              ${renderHistory()}
            </ol>
          </section>
        </aside>

        <section class="board-panel">
          <div class="board-title-row">
            <div>
              <span class="board-kicker">
                Reino
              </span>

              <strong>
                Portugal Continental
              </strong>
            </div>

            <span class="board-seed">
              Seed ${escapeHtml(
                game.seed,
              )}
            </span>
          </div>

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
                ${escapeHtml(
                  (
                    game.getCurrentSevenDiscardPlayer?.() ||
                    game.currentPlayer
                  ).name,
                )}
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

          <section class="panel bank-panel">
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
                        getResource(
                          resourceId,
                        ).shortName,
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
  let result =
    null;

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

  if (
    game.phase ===
    GAME_PHASES
      .SETUP_ROAD
  ) {
    statusMessage =
      'Agora escolha um Caminho Real ou uma Rota Marítima dourada ligada à Vila.';

    statusType =
      'success';
  } else {
    statusMessage =
      'Construção concluída.';

    statusType =
      'success';
  }

  renderGame();
}

function handleTerritoryClick(
  territoryId,
) {
  if (
    game.phase !==
      GAME_PHASES
        .EVENT_SEVEN ||
    game.sevenEvent
      ?.step !==
      'choose-target'
  ) {
    return;
  }

  const validIds =
    new Set(
      game.getSevenValidTerritoryIds(),
    );

  if (
    !validIds.has(
      territoryId,
    )
  ) {
    return;
  }

  const result =
    game.placeSevenThreat(
      'territory',
      territoryId,
    );

  if (!result.success) {
    setStatus(
      result.reason,
      'error',
    );
    return;
  }

  saveGame();

  statusMessage =
    game.phase ===
    GAME_PHASES
      .TURN_ACTIONS
      ? 'Evento 7 concluído. Pode continuar a Jornada.'
      : 'A ameaça foi movida. Escolha um adversário.';

  statusType =
    'success';

  renderGame();
}

function handleEdgeClick(
  edgeId,
) {
  let result =
    null;

  let completedSegment =
    null;

  const edge =
    game.board.edges.find(
      (item) =>
        item.id ===
        edgeId,
    );

  if (
    game.phase ===
      GAME_PHASES
        .EVENT_SEVEN &&
    game.sevenEvent
      ?.step ===
      'choose-target' &&
    game.sevenEvent
      ?.selectedThreat ===
      'storm'
  ) {
    const validIds =
      new Set(
        game.getSevenValidEdgeIds(),
      );

    if (!validIds.has(edgeId)) {
      return;
    }

    result =
      game.placeSevenThreat(
        'edge',
        edgeId,
      );

    if (result.success) {
      saveGame();

      statusMessage =
        game.phase ===
        GAME_PHASES
          .TURN_ACTIONS
          ? 'Evento 7 concluído. Pode continuar a Jornada.'
          : 'A Tempestade foi movida. Escolha um adversário.';

      statusType =
        'success';

      renderGame();
      return;
    }
  } else if (
    game.phase ===
    GAME_PHASES
      .SETUP_ROAD
  ) {
    if (
      edge?.isCoastal
    ) {
      result =
        game.placeInitialSeaRoute(
          edgeId,
        );

      completedSegment =
        'sea-route';
    } else {
      result =
        game.placeInitialRoad(
          edgeId,
        );

      completedSegment =
        'road';
    }
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

    completedSegment =
      'road';
  } else if (
    game.phase ===
      GAME_PHASES
        .TURN_ACTIONS &&
    selectedAction ===
      'sea-route'
  ) {
    result =
      game.buildSeaRoute(
        edgeId,
      );

    completedSegment =
      'sea-route';
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

  if (
    game.phase ===
    GAME_PHASES
      .SETUP_VILLAGE
  ) {
    statusMessage =
      `${game.currentPlayer.name}: escolha o local da sua Vila.`;

    statusType =
      'success';
  } else if (
    game.phase ===
    GAME_PHASES
      .TURN_ROLL
  ) {
    statusMessage =
      'Preparação concluída. A primeira Jornada pode começar.';

    statusType =
      'success';
  } else {
    statusMessage =
      completedSegment ===
        'sea-route'
        ? 'Rota Marítima construída.'
        : 'Caminho Real construído.';

    statusType =
      'success';
  }

  renderGame();
}

function setAction(
  action,
) {
  selectedAction =
    selectedAction ===
      action
      ? null
      : action;

  statusMessage =
    selectedAction
      ? 'Os locais onde esta ação é válida estão destacados a dourado.'
      : '';

  statusType =
    'info';

  renderGame();
}

function attachGameEvents() {
  document
    .querySelectorAll(
      '[data-territory-id]',
    )
    .forEach(
      (element) => {
        element.addEventListener(
          'click',
          () =>
            handleTerritoryClick(
              element
                .dataset
                .territoryId,
            ),
        );
      },
    );

  document
    .querySelectorAll(
      '[data-vertex-id]',
    )
    .forEach(
      (element) => {
        element.addEventListener(
          'click',
          () =>
            handleVertexClick(
              element
                .dataset
                .vertexId,
            ),
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
          () =>
            handleEdgeClick(
              element
                .dataset
                .edgeId,
            ),
        );
      },
    );

  document
    .querySelectorAll(
      '[data-seven-discard-resource]',
    )
    .forEach(
      (select) => {
        select.addEventListener(
          'change',
          () => {
            const resourceId =
              select.dataset
                .sevenDiscardResource;

            sevenDiscardDraft[
              resourceId
            ] =
              Number(
                select.value,
              ) || 0;

            renderGame();
          },
        );
      },
    );

  document
    .querySelector(
      '#confirm-seven-discard',
    )
    ?.addEventListener(
      'click',
      () => {
        const result =
          game.discardForSeven(
            sevenDiscardDraft,
          );

        if (!result.success) {
          setStatus(
            result.reason,
            'error',
          );
          return;
        }

        sevenDiscardDraft = {};
        sevenDiscardPlayerId = null;
        saveGame();
        statusMessage =
          game.sevenEvent
            ?.step ===
            'discard'
            ? 'Passe o dispositivo ao próximo jogador que tem de descartar.'
            : 'Descartes concluídos. O jogador ativo escolhe agora a ameaça.';
        statusType =
          'success';
        renderGame();
      },
    );

  document
    .querySelectorAll(
      '[data-seven-threat]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const result =
              game.chooseSevenThreat(
                button.dataset
                  .sevenThreat,
              );

            if (!result.success) {
              setStatus(
                result.reason,
                'error',
              );
              return;
            }

            saveGame();
            statusMessage =
              result.threatType ===
              'storm'
                ? 'Escolha uma região costeira ou ligação marítima dourada.'
                : 'Escolha um território dourado para o Contrabandista.';
            statusType =
              'warning';
            renderGame();
          },
        );
      },
    );

  document
    .querySelectorAll(
      '[data-seven-victim]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const result =
              game.resolveSevenVictim(
                button.dataset
                  .sevenVictim,
              );

            if (!result.success) {
              setStatus(
                result.reason,
                'error',
              );
              return;
            }

            saveGame();
            statusMessage =
              result.resourceId
                ? 'Recurso retirado. O Evento 7 terminou.'
                : 'O adversário já não tinha recursos. O Evento 7 terminou.';
            statusType =
              'success';
            renderGame();
          },
        );
      },
    );

  document
    .querySelector(
      '#skip-seven-theft',
    )
    ?.addEventListener(
      'click',
      () => {
        const result =
          game.skipSevenTheft();

        if (!result.success) {
          setStatus(
            result.reason,
            'error',
          );
          return;
        }

        saveGame();
        statusMessage =
          'Evento 7 concluído. Pode continuar a Jornada.';
        statusType =
          'success';
        renderGame();
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
          () =>
            setAction(
              button
                .dataset
                .action,
            ),
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

        statusMessage =
          result.roll.total ===
          7
            ? game.sevenEvent
                ?.step ===
                'discard'
              ? 'Saiu 7. Começam os descartes obrigatórios.'
              : 'Saiu 7. Escolha agora o Contrabandista ou a Tempestade Atlântica.'
            : `Resultado ${result.roll.total}: a produção foi resolvida.`;

        statusType =
          result.roll.total ===
          7
            ? 'warning'
            : 'success';

        renderGame();
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

        statusMessage =
          `É agora a vez de ${game.currentPlayer.name}.`;

        statusType =
          'info';

        renderGame();
      },
    );

  document
    .querySelector(
      '#save-button',
    )
    ?.addEventListener(
      'click',
      () =>
        saveGame({
          silent: false,
        }),
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
