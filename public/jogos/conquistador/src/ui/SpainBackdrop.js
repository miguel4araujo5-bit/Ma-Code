import { GAME_CONFIG } from '../data/gameConfig.js';
import { buildBoardTopology } from '../game/BoardTopology.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

let scheduled = false;

function getViewBox(svg) {
  const viewBox = svg?.viewBox?.baseVal;

  if (
    !viewBox ||
    !Number.isFinite(viewBox.width) ||
    !Number.isFinite(viewBox.height) ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    return null;
  }

  return {
    x: viewBox.x,
    y: viewBox.y,
    width: viewBox.width,
    height: viewBox.height,
  };
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(
    SVG_NS,
    tag,
  );

  for (const [name, value] of Object.entries(attributes)) {
    if (value == null) {
      continue;
    }

    element.setAttribute(
      name,
      String(value),
    );
  }

  return element;
}

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

function createCanonicalBoard() {
  return {
    id: 'spain-backdrop-board',
    seed: 'spain-backdrop',
    shape: GAME_CONFIG.board.shape,
    maskVersion: GAME_CONFIG.board.maskVersion,

    territories: GAME_CONFIG.board.mask.map(
      (slot) => ({
        id: `territory-${slot.slotId}`,
        slotId: slot.slotId,
        zone: slot.zone,
        q: slot.q,
        r: slot.r,
        isCoastal: Boolean(slot.coastal),
        blocked: false,
      }),
    ),
  };
}

function collectDisplayVertices(
  svg,
  topology,
) {
  const result = new Map();

  for (const vertex of topology.vertices) {
    const element = svg.querySelector(
      `[data-vertex-id="${vertex.id}"]`,
    );

    const position = vertexPosition(
      element,
    );

    if (position) {
      result.set(
        String(vertex.id),
        position,
      );
    }
  }

  return result;
}

function orderLandBorder(edges) {
  const edgesByVertex = new Map();

  for (const edge of edges) {
    for (const vertexId of edge.vertexIds) {
      const key = String(vertexId);

      if (!edgesByVertex.has(key)) {
        edgesByVertex.set(
          key,
          [],
        );
      }

      edgesByVertex
        .get(key)
        .push(edge);
    }
  }

  const endpoints = [
    ...edgesByVertex.entries(),
  ]
    .filter(
      ([, connected]) =>
        connected.length === 1,
    )
    .map(
      ([vertexId]) =>
        vertexId,
    );

  if (endpoints.length !== 2) {
    return [];
  }

  const orderedVertexIds = [
    endpoints[0],
  ];

  const usedEdges = new Set();

  let currentVertexId =
    endpoints[0];

  while (
    usedEdges.size <
    edges.length
  ) {
    const nextEdge = (
      edgesByVertex.get(
        currentVertexId,
      ) ?? []
    ).find(
      (edge) =>
        !usedEdges.has(
          String(edge.id),
        ),
    );

    if (!nextEdge) {
      break;
    }

    usedEdges.add(
      String(nextEdge.id),
    );

    const [
      firstVertexId,
      secondVertexId,
    ] =
      nextEdge.vertexIds.map(
        String,
      );

    currentVertexId =
      firstVertexId ===
      currentVertexId
        ? secondVertexId
        : firstVertexId;

    orderedVertexIds.push(
      currentVertexId,
    );
  }

  return orderedVertexIds;
}

function orientNorthToSouth(
  vertexIds,
  positions,
) {
  if (vertexIds.length < 2) {
    return vertexIds;
  }

  const first = positions.get(
    String(vertexIds[0]),
  );

  const last = positions.get(
    String(
      vertexIds.at(-1),
    ),
  );

  if (!first || !last) {
    return vertexIds;
  }

  if (first.y < last.y) {
    return vertexIds;
  }

  if (first.y > last.y) {
    return [
      ...vertexIds,
    ].reverse();
  }

  return first.x <= last.x
    ? vertexIds
    : [
        ...vertexIds,
      ].reverse();
}

function buildLandPath(
  points,
  viewBox,
) {
  if (points.length < 2) {
    return null;
  }

  const start = points[0];
  const end = points.at(-1);

  const topY =
    viewBox.y -
    viewBox.height *
      0.035;

  const rightX =
    viewBox.x +
    viewBox.width *
      1.035;

  const bottomY =
    Math.min(
      viewBox.y +
        viewBox.height *
          1.02,

      end.y +
        viewBox.height *
          0.055,
    );

  const topLeftX =
    Math.max(
      viewBox.x -
        viewBox.width *
          0.02,

      start.x -
        viewBox.width *
          0.16,
    );

  const borderCommands =
    points
      .slice(1)
      .map(
        (point) =>
          `L ${point.x} ${point.y}`,
      )
      .join(' ');

  const landPath = [
    `M ${start.x} ${start.y}`,
    borderCommands,
    `L ${rightX} ${bottomY}`,
    `L ${rightX} ${topY}`,
    `L ${topLeftX} ${topY}`,
    `L ${start.x} ${start.y}`,
    'Z',
  ].join(' ');

  const borderPath = [
    `M ${start.x} ${start.y}`,
    borderCommands,
  ].join(' ');

  return {
    landPath,
    borderPath,
  };
}

function renderSpainBackdrop() {
  const svg =
    document.querySelector(
      '.board-svg',
    );

  if (!svg) {
    return;
  }

  const viewBox =
    getViewBox(svg);

  if (!viewBox) {
    return;
  }

  const topology =
    buildBoardTopology(
      createCanonicalBoard(),
    );

  const positions =
    collectDisplayVertices(
      svg,
      topology,
    );

  if (
    positions.size !==
    topology.vertices.length
  ) {
    return;
  }

  const landBoundaryEdges =
    topology.edges.filter(
      (edge) =>
        edge.isBoundary &&
        !edge.isCoastal,
    );

  const borderVertexIds =
    orientNorthToSouth(
      orderLandBorder(
        landBoundaryEdges,
      ),
      positions,
    );

  const borderPoints =
    borderVertexIds
      .map(
        (vertexId) =>
          positions.get(
            String(vertexId),
          ),
      )
      .filter(Boolean);

  const paths =
    buildLandPath(
      borderPoints,
      viewBox,
    );

  if (!paths) {
    return;
  }

  svg
    .querySelector(
      '[data-layer="spain-backdrop"]',
    )
    ?.remove();

  const layer =
    createSvgElement(
      'g',
      {
        class:
          'spain-backdrop',

        'data-layer':
          'spain-backdrop',

        'aria-hidden':
          'true',
      },
    );

  const land =
    createSvgElement(
      'path',
      {
        class:
          'spain-backdrop__land',

        d:
          paths.landPath,
      },
    );

  const border =
    createSvgElement(
      'path',
      {
        class:
          'spain-backdrop__border',

        d:
          paths.borderPath,
      },
    );

  layer.append(
    land,
    border,
  );

  const decorationLayer =
    svg.querySelector(
      '.map-decoration',
    );

  const territoryLayer =
    svg.querySelector(
      '.territory-layer',
    );

  const anchor =
    decorationLayer ??
    territoryLayer;

  if (anchor) {
    svg.insertBefore(
      layer,
      anchor,
    );
  } else {
    svg.appendChild(
      layer,
    );
  }
}

function scheduleRender() {
  if (scheduled) {
    return;
  }

  scheduled = true;

  requestAnimationFrame(
    () => {
      scheduled = false;

      renderSpainBackdrop();
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
      childList: true,
      subtree: true,
    },
  );

  scheduleRender();
}
