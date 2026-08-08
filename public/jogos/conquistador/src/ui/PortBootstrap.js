import { GAME_CONFIG } from '../data/gameConfig.js';
import { maritimeSidesForSlot } from '../data/coastline.js';
import { classifyCoast } from '../game/CoastTopology.js';
import { createPorts } from '../game/PortManager.js';
import { PortRenderer } from './PortRenderer.js?v=ports-2';

const COORDINATE_PRECISION = 3;
const renderedSignatures = new WeakMap();

function round(value) {
  return Number(Number(value).toFixed(COORDINATE_PRECISION));
}

function coordinateKey(x, y) {
  return `${round(x)},${round(y)}`;
}

function segmentKey(first, second) {
  return [
    coordinateKey(first.x, first.y),
    coordinateKey(second.x, second.y),
  ]
    .sort()
    .join('|');
}

function parseTranslate(value) {
  const match = String(value ?? '').match(
    /translate\(\s*(-?[\d.]+)(?:[\s,]+)(-?[\d.]+)\s*\)/i,
  );

  if (!match) return null;

  const x = Number(match[1]);
  const y = Number(match[2]);

  return Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : null;
}

function vertexPosition(element) {
  if (!element) return null;

  if (element.tagName.toLowerCase() === 'circle') {
    const x = Number(element.getAttribute('cx'));
    const y = Number(element.getAttribute('cy'));

    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  return parseTranslate(element.getAttribute('transform'));
}

function parsePolygonPoints(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);

      return Number.isFinite(x) && Number.isFinite(y)
        ? { x, y }
        : null;
    })
    .filter(Boolean);
}

function collectSegmentClasses(svg) {
  const counts = new Map();
  const maritimeCandidates = new Set();

  const polygons = [
    ...svg.querySelectorAll('.territory-layer polygon.territory'),
  ];

  polygons.forEach((polygon, territoryIndex) => {
    const points = parsePolygonPoints(
      polygon.getAttribute('points'),
    );

    for (
      let sideIndex = 0;
      sideIndex < points.length;
      sideIndex += 1
    ) {
      const key = segmentKey(
        points[sideIndex],
        points[(sideIndex + 1) % points.length],
      );

      counts.set(
        key,
        (counts.get(key) ?? 0) + 1,
      );
    }

    const slot = GAME_CONFIG.board.mask[territoryIndex];
    if (!slot) return;

    for (const sideIndex of maritimeSidesForSlot(slot.slotId)) {
      const first = points[sideIndex];
      const second = points[(sideIndex + 1) % points.length];

      if (first && second) {
        maritimeCandidates.add(
          segmentKey(first, second),
        );
      }
    }
  });

  const boundarySegments = new Set(
    [...counts.entries()]
      .filter(([, count]) => count === 1)
      .map(([key]) => key),
  );

  const coastalSegments = new Set(
    [...maritimeCandidates].filter((key) =>
      boundarySegments.has(key),
    ),
  );

  return {
    boundarySegments,
    coastalSegments,
  };
}

function collectVertices(svg) {
  const vertices = [];
  const vertexByCoordinate = new Map();
  const vertexElements = new Map();

  svg
    .querySelectorAll('[data-vertex-id]')
    .forEach((element) => {
      const id = element.dataset.vertexId;

      if (!id || vertexElements.has(id)) return;

      const position = vertexPosition(element);
      if (!position) return;

      const vertex = {
        id,
        x: position.x,
        y: position.y,
        territoryIds: [],
        edgeIds: [],
        neighborVertexIds: [],
        isBoundary: false,
        isCoastal: false,
      };

      vertices.push(vertex);
      vertexElements.set(id, element);

      vertexByCoordinate.set(
        coordinateKey(position.x, position.y),
        vertex,
      );
    });

  return {
    vertices,
    vertexByCoordinate,
    vertexElements,
  };
}

function nearestVertex(
  vertexByCoordinate,
  vertices,
  point,
) {
  const exact = vertexByCoordinate.get(
    coordinateKey(point.x, point.y),
  );

  if (exact) return exact;

  let closest = null;
  let closestDistance = Infinity;

  for (const vertex of vertices) {
    const distance = Math.hypot(
      vertex.x - point.x,
      vertex.y - point.y,
    );

    if (distance < closestDistance) {
      closest = vertex;
      closestDistance = distance;
    }
  }

  return closestDistance <= 0.1
    ? closest
    : null;
}

function collectTopology(svg) {
  const {
    boundarySegments,
    coastalSegments,
  } = collectSegmentClasses(svg);

  const {
    vertices,
    vertexByCoordinate,
    vertexElements,
  } = collectVertices(svg);

  const vertexById = new Map(
    vertices.map((vertex) => [
      vertex.id,
      vertex,
    ]),
  );

  const edgeElements = new Map();
  const edges = [];

  svg
    .querySelectorAll('.edge-layer [data-edge-id]')
    .forEach((element) => {
      const id = element.dataset.edgeId;
      if (!id) return;

      const firstPoint = {
        x: Number(element.getAttribute('x1')),
        y: Number(element.getAttribute('y1')),
      };

      const secondPoint = {
        x: Number(element.getAttribute('x2')),
        y: Number(element.getAttribute('y2')),
      };

      if (
        !Number.isFinite(firstPoint.x) ||
        !Number.isFinite(firstPoint.y) ||
        !Number.isFinite(secondPoint.x) ||
        !Number.isFinite(secondPoint.y)
      ) {
        return;
      }

      const firstVertex = nearestVertex(
        vertexByCoordinate,
        vertices,
        firstPoint,
      );

      const secondVertex = nearestVertex(
        vertexByCoordinate,
        vertices,
        secondPoint,
      );

      if (!firstVertex || !secondVertex) return;

      const key = segmentKey(
        firstPoint,
        secondPoint,
      );

      const isBoundary =
        boundarySegments.has(key);

      const isCoastal =
        coastalSegments.has(key);

      const edge = {
        id,

        vertexIds: [
          firstVertex.id,
          secondVertex.id,
        ],

        territoryIds: isBoundary
          ? ['boundary-territory']
          : [
              'internal-territory-a',
              'internal-territory-b',
            ],

        isBoundary,
        isCoastal,
      };

      edges.push(edge);
      edgeElements.set(id, element);

      firstVertex.edgeIds.push(id);
      secondVertex.edgeIds.push(id);

      if (
        !firstVertex.neighborVertexIds.includes(
          secondVertex.id,
        )
      ) {
        firstVertex.neighborVertexIds.push(
          secondVertex.id,
        );
      }

      if (
        !secondVertex.neighborVertexIds.includes(
          firstVertex.id,
        )
      ) {
        secondVertex.neighborVertexIds.push(
          firstVertex.id,
        );
      }

      if (isBoundary) {
        firstVertex.isBoundary = true;
        secondVertex.isBoundary = true;
      }

      if (isCoastal) {
        firstVertex.isCoastal = true;
        secondVertex.isCoastal = true;
      }
    });

  return {
    topology: {
      vertices: [...vertexById.values()],
      edges,
    },

    edgeElements,
    vertexElements,
  };
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

function clearPortTargets(
  edgeElements,
  vertexElements,
) {
  for (const element of edgeElements.values()) {
    delete element.dataset.portId;
    delete element.dataset.coastal;
  }

  for (const element of vertexElements.values()) {
    delete element.dataset.portIds;
    delete element.dataset.coastal;
  }
}

function markPortTargets(
  ports,
  edgeElements,
  vertexElements,
) {
  clearPortTargets(
    edgeElements,
    vertexElements,
  );

  for (const port of ports) {
    const edgeElement =
      edgeElements.get(
        String(port.edgeId),
      );

    if (edgeElement) {
      edgeElement.dataset.portId = port.id;
      edgeElement.dataset.coastal = 'true';
    }

    for (const vertexId of port.vertexIds ?? []) {
      const vertexElement =
        vertexElements.get(
          String(vertexId),
        );

      if (!vertexElement) continue;

      const existing =
        vertexElement.dataset.portIds
          ? vertexElement.dataset.portIds.split(',')
          : [];

      if (!existing.includes(port.id)) {
        existing.push(port.id);
      }

      vertexElement.dataset.portIds =
        existing.join(',');

      vertexElement.dataset.coastal = 'true';
    }
  }
}

function renderPorts() {
  const svg = document.querySelector(
    '.board-svg',
  );

  if (!svg) return;

  const seed = readSeed();

  const {
    topology,
    edgeElements,
    vertexElements,
  } = collectTopology(svg);

  if (
    !topology.vertices.length ||
    !topology.edges.length
  ) {
    return;
  }

  const signature = [
    seed,
    topology.vertices.length,
    topology.edges.length,

    topology.edges
      .filter((edge) => edge.isCoastal)
      .map((edge) => edge.id)
      .join(','),

  ].join('|');

  if (
    renderedSignatures.get(svg) === signature &&
    svg.querySelector('[data-layer="ports"]')
  ) {
    return;
  }

  svg
    .querySelector('[data-layer="ports"]')
    ?.remove();

  const coast = classifyCoast(topology);

  const ports = createPorts(
    coast,
    { seed },
  );

  markPortTargets(
    ports,
    edgeElements,
    vertexElements,
  );

  const renderer = new PortRenderer({
    svg,
    topology,
  });

  renderer.render(
    ports,
    {
      offset: 27,

      onPortClick(port) {
        svg.dispatchEvent(
          new CustomEvent(
            'conquistador:port-click',
            {
              bubbles: true,
              detail: { port },
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

let scheduled = false;

function scheduleRender() {
  if (scheduled) return;

  scheduled = true;

  requestAnimationFrame(() => {
    scheduled = false;
    renderPorts();
  });
}

const app = document.querySelector('#app');

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
