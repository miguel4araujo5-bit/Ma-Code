import { GAME_CONFIG } from '../data/gameConfig.js';
import { buildBoardTopology } from '../game/BoardTopology.js';
import { PortRenderer } from './PortRenderer.js?v=ports-2';

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
    const x = Number(element.getAttribute('cx'));
    const y = Number(element.getAttribute('cy'));

    if (Number.isFinite(x) && Number.isFinite(y)) {
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
      .trim() || 'conquistador'
  );
}

/*
 * Cria uma cópia estrutural do mapa oficial.
 *
 * Não gera recursos, números ou peças.
 * Serve apenas para obter exatamente os mesmos:
 *
 * - vertex IDs
 * - edge IDs
 * - arestas de perímetro
 * - arestas marítimas
 * - vértices costeiros
 * - Portos
 *
 * que o motor principal.
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
 * BoardTopology passa a ser a única fonte de verdade
 * também para a camada visual dos Portos.
 */
function createOfficialTopology(seed) {
  return buildBoardTopology(
    createCanonicalBoard(
      seed,
    ),
  );
}

/*
 * Recolhe os elementos que já foram desenhados
 * pelo main.js.
 *
 * Os IDs são os mesmos IDs produzidos pelo motor.
 */
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
 * A topologia oficial utiliza coordenadas matemáticas
 * do tabuleiro.
 *
 * O SVG já contém coordenadas depois da aplicação
 * de padding/mapX/mapY.
 *
 * Mantemos toda a lógica oficial, substituindo apenas
 * as coordenadas dos vértices pelas coordenadas visuais
 * existentes no SVG.
 */
function buildDisplayTopology(
  officialTopology,
  vertexElements,
) {
  const vertices =
    officialTopology
      .vertices
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
    officialTopology
      .edges
      .filter(
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
  };
}

/*
 * Remove apenas metadata introduzida
 * por este módulo.
 *
 * Não altera classes, estilos, construções
 * ou caminhos do jogo.
 */
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

/*
 * Espelha no SVG a classificação que já existe
 * no BoardTopology.
 *
 * Isto também deixa o DOM preparado para
 * as futuras Rotas Marítimas.
 */
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
    topology
      .edges
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
   * Esta é agora a única classificação usada.
   *
   * Nada é inferido através da posição
   * dos polígonos no DOM.
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
   * Segurança:
   * nunca desenhar Portos sobre uma topologia
   * parcialmente reconstruída.
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

  /*
   * Copia a classificação oficial para o SVG.
   *
   * A partir deste momento:
   *
   * data-coastal="true"
   *
   * significa efetivamente costa marítima,
   * não simplesmente perímetro.
   */
  markOfficialTopology(
    officialTopology,
    edgeElements,
    vertexElements,
  );

  /*
   * Os próprios Portos já são produzidos
   * pelo BoardTopology através do PortManager.
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
      offset: 27,

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
