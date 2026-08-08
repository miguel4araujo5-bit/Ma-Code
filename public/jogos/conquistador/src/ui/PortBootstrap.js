import { GAME_CONFIG } from '../data/gameConfig.js';
import { buildBoardTopology } from '../game/BoardTopology.js';
import { PortRenderer } from './PortRenderer.js?v=ports-4';

const renderedSignatures = new WeakMap();

function parseTranslate(value) {
  const match = String(value ?? '').match(
    /translate\(\s*(-?[\d.]+)(?:[\s,]+)(-?[\d.]+)\s*\)/i,
  );

  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);

  return Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : null;
}

function vertexPosition(element) {
  if (!element) {
    return null;
  }

  if (element.tagName.toLowerCase() === 'circle') {
    const x = Number(
      element.getAttribute('cx'),
    );

    const y = Number(
      element.getAttribute('cy'),
    );

    if (
      Number.isFinite(x) &&
      Number.isFinite(y)
    ) {
      return { x, y };
    }
  }

  return parseTranslate(
    element.getAttribute('transform'),
  );
}

function readSeed() {
  const text =
    document.querySelector('.board-seed')
      ?.textContent ?? '';

  return (
    text
      .replace(/^\s*Seed\s*/i, '')
      .trim() ||
    'conquistador'
  );
}

/*
 * Cria apenas a geometria estrutural oficial.
 *
 * Não interessa aqui qual recurso ou número
 * está em cada território.
 *
 * Precisamos de:
 * - slotId
 * - q/r
 * - territórios
 * - vértices
 * - arestas
 * - costa
 * - Portos
 */
function createCanonicalBoard(seed) {
  return {
    id: `board-${seed}`,

    seed,

    shape:
      GAME_CONFIG.board.shape,

    maskVersion:
      GAME_CONFIG.board.maskVersion,

    territories:
      GAME_CONFIG.board.mask.map(
        (slot) => ({
          id:
            `territory-${slot.slotId}`,

          slotId:
            slot.slotId,

          zone:
            slot.zone,

          q:
            slot.q,

          r:
            slot.r,

          isCoastal:
            Boolean(
              slot.coastal,
            ),

          blocked:
            false,
        }),
      ),
  };
}

/*
 * BoardTopology passa a ser a única
 * fonte de verdade da geometria marítima.
 */
function createOfficialTopology(seed) {
  return buildBoardTopology(
    createCanonicalBoard(seed),
  );
}

function collectDomReferences(svg) {
  const vertexElements =
    new Map();

  const edgeElements =
    new Map();

  svg
    .querySelectorAll(
      '[data-vertex-id]',
    )
    .forEach(
      (element) => {
        const id =
          element.dataset.vertexId;

        if (
          id &&
          !vertexElements.has(id)
        ) {
          vertexElements.set(
            id,
            element,
          );
        }
      },
    );

  svg
    .querySelectorAll(
      '.edge-layer [data-edge-id]',
    )
    .forEach(
      (element) => {
        const id =
          element.dataset.edgeId;

        if (id) {
          edgeElements.set(
            id,
            element,
          );
        }
      },
    );

  return {
    vertexElements,
    edgeElements,
  };
}

/*
 * Mantemos a topologia oficial,
 * mas substituímos as coordenadas matemáticas
 * dos vértices pelas coordenadas que o SVG
 * está efetivamente a usar.
 *
 * IMPORTANTE:
 * preservamos também territories.
 *
 * O PortRenderer necessita dos territory.vertexIds
 * para saber qual dos dois lados de cada aresta
 * corresponde a terra.
 */
function buildDisplayTopology(
  officialTopology,
  vertexElements,
) {
  const vertices =
    officialTopology.vertices
      .map(
        (vertex) => {
          const element =
            vertexElements.get(
              String(
                vertex.id,
              ),
            );

          const position =
            vertexPosition(
              element,
            );

          if (!position) {
            return null;
          }

          return {
            ...vertex,

            x:
              position.x,

            y:
              position.y,
          };
        },
      )
      .filter(Boolean);

  const visibleVertexIds =
    new Set(
      vertices.map(
        (vertex) =>
          String(
            vertex.id,
          ),
      ),
    );

  const edges =
    officialTopology.edges.filter(
      (edge) =>
        (
          edge.vertexIds ??
          []
        ).every(
          (vertexId) =>
            visibleVertexIds.has(
              String(
                vertexId,
              ),
            ),
        ),
    );

  return {
    ...officialTopology,

    vertices,

    edges,

    /*
     * Não remover.
     *
     * É precisamente esta informação
     * que faltava na versão anterior.
     */
    territories:
      officialTopology.territories,
  };
}

function clearMaritimeMetadata(
  edgeElements,
  vertexElements,
) {
  for (
    const element
    of edgeElements.values()
  ) {
    delete element
      .dataset
      .coastal;

    delete element
      .dataset
      .boundary;

    delete element
      .dataset
      .coastType;

    delete element
      .dataset
      .portId;
  }

  for (
    const element
    of vertexElements.values()
  ) {
    delete element
      .dataset
      .coastal;

    delete element
      .dataset
      .boundary;

    delete element
      .dataset
      .portIds;
  }
}

function markOfficialTopology(
  topology,
  edgeElements,
  vertexElements,
) {
  clearMaritimeMetadata(
    edgeElements,
    vertexElements,
  );

  for (
    const edge
    of topology.edges
  ) {
    const element =
      edgeElements.get(
        String(
          edge.id,
        ),
      );

    if (!element) {
      continue;
    }

    element.dataset.boundary =
      edge.isBoundary
        ? 'true'
        : 'false';

    element.dataset.coastal =
      edge.isCoastal
        ? 'true'
        : 'false';

    if (
      edge.coastType
    ) {
      element.dataset.coastType =
        edge.coastType;
    }
  }

  for (
    const vertex
    of topology.vertices
  ) {
    const element =
      vertexElements.get(
        String(
          vertex.id,
        ),
      );

    if (!element) {
      continue;
    }

    element.dataset.boundary =
      vertex.isBoundary
        ? 'true'
        : 'false';

    element.dataset.coastal =
      vertex.isCoastal
        ? 'true'
        : 'false';
  }
}

function markPortTargets(
  ports,
  edgeElements,
  vertexElements,
) {
  for (
    const port
    of ports
  ) {
    const edgeElement =
      edgeElements.get(
        String(
          port.edgeId,
        ),
      );

    if (
      edgeElement
    ) {
      edgeElement
        .dataset
        .portId =
        port.id;
    }

    for (
      const vertexId
      of port.vertexIds ??
        []
    ) {
      const vertexElement =
        vertexElements.get(
          String(
            vertexId,
          ),
        );

      if (
        !vertexElement
      ) {
        continue;
      }

      const existing =
        vertexElement
          .dataset
          .portIds
          ? vertexElement
              .dataset
              .portIds
              .split(',')
          : [];

      if (
        !existing.includes(
          port.id,
        )
      ) {
        existing.push(
          port.id,
        );
      }

      vertexElement
        .dataset
        .portIds =
        existing.join(',');
    }
  }
}

function createSignature(
  seed,
  topology,
) {
  const coastalEdgeIds =
    topology.edges
      .filter(
        (edge) =>
          edge.isCoastal,
      )
      .map(
        (edge) =>
          edge.id,
      )
      .join(',');

  const portIds =
    (
      topology.ports ??
      []
    )
      .map(
        (port) =>
          `${port.id}:${port.edgeId}`,
      )
      .join(',');

  return [
    seed,

    topology
      .vertices
      .length,

    topology
      .edges
      .length,

    coastalEdgeIds,

    portIds,

  ].join('|');
}

function renderPorts() {
  const svg =
    document.querySelector(
      '.board-svg',
    );

  if (!svg) {
    return;
  }

  const seed =
    readSeed();

  /*
   * Não reconstruímos mais a costa
   * olhando para polígonos SVG.
   *
   * Usamos diretamente o mesmo motor
   * que cria o tabuleiro do jogo.
   */
  const officialTopology =
    createOfficialTopology(
      seed,
    );

  const {
    vertexElements,
    edgeElements,
  } =
    collectDomReferences(
      svg,
    );

  if (
    !vertexElements.size ||
    !edgeElements.size
  ) {
    return;
  }

  const displayTopology =
    buildDisplayTopology(
      officialTopology,
      vertexElements,
    );

  /*
   * Não desenhar Portos se os IDs
   * do DOM não coincidirem integralmente
   * com a topologia oficial.
   */
  if (
    displayTopology
      .vertices
      .length !==
      officialTopology
        .vertices
        .length ||
    displayTopology
      .edges
      .length !==
      officialTopology
        .edges
        .length
  ) {
    return;
  }

  const signature =
    createSignature(
      seed,
      officialTopology,
    );

  if (
    renderedSignatures.get(
      svg,
    ) ===
      signature &&
    svg.querySelector(
      '[data-layer="ports"]',
    )
  ) {
    return;
  }

  svg
    .querySelector(
      '[data-layer="ports"]',
    )
    ?.remove();

  markOfficialTopology(
    officialTopology,
    edgeElements,
    vertexElements,
  );

  /*
   * Os Portos são os que o próprio
   * BoardTopology já calculou.
   */
  const ports =
    officialTopology
      .ports ??
    [];

  markPortTargets(
    ports,
    edgeElements,
    vertexElements,
  );

  const renderer =
    new PortRenderer({
      svg,

      topology:
        displayTopology,
    });

  renderer.render(
    ports,
    {
      offset: 38,

      onPortClick(
        port,
      ) {
        svg.dispatchEvent(
          new CustomEvent(
            'conquistador:port-click',
            {
              bubbles:
                true,

              detail: {
                port,
              },
            },
          ),
        );
      },
    },
  );

  renderedSignatures.set(
    svg,
    signature,
  );
}

let scheduled =
  false;

function scheduleRender() {
  if (scheduled) {
    return;
  }

  scheduled =
    true;

  requestAnimationFrame(
    () => {
      scheduled =
        false;

      renderPorts();
    },
  );
}

const app =
  document.querySelector(
    '#app',
  );

if (app) {
  new MutationObserver(
    scheduleRender,
  ).observe(
    app,
    {
      childList:
        true,

      subtree:
        true,
    },
  );

  scheduleRender();
}
