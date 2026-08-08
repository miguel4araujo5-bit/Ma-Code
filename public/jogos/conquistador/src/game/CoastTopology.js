/**
 * CONQUISTADOR — CoastTopology
 * Distingue costa marítima real, fronteira terrestre e arestas internas.
 */

const asArray = (value) => (Array.isArray(value) ? value : []);

function idOf(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return value.id != null ? String(value.id) : null;
}

function edgeVertexIds(edge) {
  const candidates = [
    edge?.vertexIds,
    edge?.vertices,
    edge?.endpoints,
    edge?.points,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length < 2) continue;
    const first = idOf(candidate[0]);
    const second = idOf(candidate[1]);
    if (first && second) return [first, second];
  }

  const first = idOf(edge?.a ?? edge?.from ?? edge?.start ?? edge?.v1);
  const second = idOf(edge?.b ?? edge?.to ?? edge?.end ?? edge?.v2);
  return first && second ? [first, second] : [];
}

function edgeTerritoryIds(edge) {
  const candidates = [
    edge?.territoryIds,
    edge?.territories,
    edge?.hexIds,
    edge?.hexes,
    edge?.tileIds,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.map(idOf).filter(Boolean);
  }

  return [];
}

function pointOf(vertex) {
  const x = Number(vertex?.x ?? vertex?.position?.x ?? vertex?.point?.x);
  const y = Number(vertex?.y ?? vertex?.position?.y ?? vertex?.point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function detectBoundary(edge) {
  if (typeof edge?.isPerimeter === 'boolean') return edge.isPerimeter;
  if (typeof edge?.perimeter === 'boolean') return edge.perimeter;
  if (typeof edge?.isBoundary === 'boolean') return edge.isBoundary;
  if (typeof edge?.boundary === 'boolean') return edge.boundary;

  const territories = edgeTerritoryIds(edge);
  return territories.length ? territories.length === 1 : false;
}

function detectCoastal(edge) {
  if (typeof edge?.isCoastal === 'boolean') return edge.isCoastal;
  if (typeof edge?.coastal === 'boolean') return edge.coastal;

  // Compatibilidade com topologias antigas sem classificação explícita.
  return detectBoundary(edge);
}

function buildCoastPaths(coastalEdges) {
  const edgeById = new Map(
    coastalEdges.map((edge) => [String(edge.id), edge]),
  );
  const edgesByVertex = new Map();

  for (const edge of coastalEdges) {
    const edgeId = String(edge.id);
    for (const vertexId of edgeVertexIds(edge)) {
      if (!edgesByVertex.has(vertexId)) edgesByVertex.set(vertexId, []);
      edgesByVertex.get(vertexId).push(edgeId);
    }
  }

  const unassigned = new Set(edgeById.keys());
  const paths = [];

  while (unassigned.size) {
    const seedEdgeId = unassigned.values().next().value;
    const componentEdgeIds = new Set();
    const queue = [seedEdgeId];

    while (queue.length) {
      const edgeId = queue.pop();
      if (componentEdgeIds.has(edgeId)) continue;

      const edge = edgeById.get(edgeId);
      if (!edge) continue;

      componentEdgeIds.add(edgeId);
      unassigned.delete(edgeId);

      for (const vertexId of edgeVertexIds(edge)) {
        for (const neighborEdgeId of edgesByVertex.get(vertexId) ?? []) {
          if (!componentEdgeIds.has(neighborEdgeId)) queue.push(neighborEdgeId);
        }
      }
    }

    const degreeByVertex = new Map();
    for (const edgeId of componentEdgeIds) {
      for (const vertexId of edgeVertexIds(edgeById.get(edgeId))) {
        degreeByVertex.set(vertexId, (degreeByVertex.get(vertexId) ?? 0) + 1);
      }
    }

    const firstEdge = edgeById.get(componentEdgeIds.values().next().value);
    const fallbackStart = edgeVertexIds(firstEdge)[0];
    const startVertexId =
      [...degreeByVertex.entries()].find(([, degree]) => degree === 1)?.[0] ??
      fallbackStart;

    const remaining = new Set(componentEdgeIds);
    const orderedEdgeIds = [];
    const orderedVertexIds = startVertexId ? [startVertexId] : [];
    let currentVertexId = startVertexId;
    let safety = componentEdgeIds.size + 2;

    while (currentVertexId && remaining.size && safety-- > 0) {
      const nextEdgeId = (edgesByVertex.get(currentVertexId) ?? []).find(
        (edgeId) => remaining.has(edgeId),
      );
      if (!nextEdgeId) break;

      const [first, second] = edgeVertexIds(edgeById.get(nextEdgeId));
      const nextVertexId = first === currentVertexId ? second : first;
      remaining.delete(nextEdgeId);
      orderedEdgeIds.push(nextEdgeId);
      orderedVertexIds.push(nextVertexId);
      currentVertexId = nextVertexId;
    }

    for (const edgeId of remaining) orderedEdgeIds.push(edgeId);

    paths.push({
      id: `coast-loop-${paths.length + 1}`,
      vertexIds: orderedVertexIds,
      edgeIds: orderedEdgeIds,
      closed:
        orderedVertexIds.length > 2 &&
        orderedVertexIds[0] === orderedVertexIds[orderedVertexIds.length - 1],
    });
  }

  return paths;
}

export function classifyCoast(topology) {
  if (!topology || typeof topology !== 'object') {
    throw new TypeError('CoastTopology: topology inválida.');
  }

  const vertices = asArray(topology.vertices);
  const edges = asArray(topology.edges);
  const vertexById = new Map(
    vertices.map((vertex) => [String(vertex.id), vertex]),
  );
  const coastalEdges = [];
  const inlandEdges = [];
  const landBoundaryEdges = [];
  const coastalVertexIds = new Set();

  for (const edge of edges) {
    const boundary = detectBoundary(edge);
    const coastal = detectCoastal(edge);
    const [first, second] = edgeVertexIds(edge);
    const enriched = {
      ...edge,
      boundary,
      coastal,
      edgeClass: coastal
        ? 'coast'
        : boundary
          ? 'land-boundary'
          : 'land-internal',
      vertexIds: first && second ? [first, second] : edge.vertexIds,
    };

    if (coastal) {
      coastalEdges.push(enriched);
      if (first) coastalVertexIds.add(first);
      if (second) coastalVertexIds.add(second);
    } else {
      inlandEdges.push(enriched);
      if (boundary) landBoundaryEdges.push(enriched);
    }
  }

  const coastalVertices = [...coastalVertexIds]
    .map((id) => vertexById.get(id))
    .filter(Boolean)
    .map((vertex) => ({ ...vertex, coastal: true }));

  const perimeterLoops = buildCoastPaths(coastalEdges);
  const coastalEdgeIds = new Set(
    coastalEdges.map((edge) => String(edge.id)),
  );

  return {
    coastalEdges,
    inlandEdges,
    landBoundaryEdges,
    coastalVertices,
    coastalVertexIds: [...coastalVertexIds],
    perimeterLoops,

    stats: {
      totalEdges: edges.length,
      coastalEdges: coastalEdges.length,
      inlandEdges: inlandEdges.length,
      landBoundaryEdges: landBoundaryEdges.length,
      totalVertices: vertices.length,
      coastalVertices: coastalVertices.length,
      perimeterLoops: perimeterLoops.length,
    },

    isCoastalVertex(vertexId) {
      return coastalVertexIds.has(String(vertexId));
    },

    isCoastalEdge(edgeId) {
      return coastalEdgeIds.has(String(edgeId));
    },

    getVertexPoint(vertexId) {
      return pointOf(vertexById.get(String(vertexId)));
    },
  };
}

export default classifyCoast;
