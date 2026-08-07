/**
 * CONQUISTADOR — CoastTopology
 * Classifica a topologia costeira a partir do resultado de BoardTopology.
 *
 * Não altera o tabuleiro. Apenas devolve uma vista derivada com:
 * - arestas internas terrestres;
 * - arestas costeiras (perímetro);
 * - vértices costeiros;
 * - sequência(s) de perímetro;
 * - metadados úteis para Portos e Rotas Marítimas.
 */

const asArray = (value) => (Array.isArray(value) ? value : [])

function idOf(value) {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value.id != null) return String(value.id)
  return null
}

function edgeVertexIds(edge) {
  const candidates = [
    edge?.vertexIds,
    edge?.vertices,
    edge?.endpoints,
    edge?.points,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length < 2) continue
    const a = idOf(candidate[0])
    const b = idOf(candidate[1])
    if (a && b) return [a, b]
  }

  const a = idOf(edge?.a ?? edge?.from ?? edge?.start ?? edge?.v1)
  const b = idOf(edge?.b ?? edge?.to ?? edge?.end ?? edge?.v2)
  return a && b ? [a, b] : []
}

function edgeTerritoryIds(edge) {
  const candidates = [
    edge?.territoryIds,
    edge?.territories,
    edge?.hexIds,
    edge?.hexes,
    edge?.tileIds,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate.map(idOf).filter(Boolean)
  }

  return []
}

function pointOf(vertex) {
  const x = Number(vertex?.x ?? vertex?.position?.x ?? vertex?.point?.x)
  const y = Number(vertex?.y ?? vertex?.position?.y ?? vertex?.point?.y)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function detectBoundary(edge) {
  if (typeof edge?.isPerimeter === 'boolean') return edge.isPerimeter
  if (typeof edge?.perimeter === 'boolean') return edge.perimeter
  if (typeof edge?.isBoundary === 'boolean') return edge.isBoundary
  if (typeof edge?.boundary === 'boolean') return edge.boundary

  const territories = edgeTerritoryIds(edge)
  if (territories.length) return territories.length === 1

  return false
}

function buildPerimeterLoops(coastalEdges) {
  const adjacency = new Map()
  const edgeByPair = new Map()

  for (const edge of coastalEdges) {
    const [a, b] = edgeVertexIds(edge)
    if (!a || !b) continue
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    if (!adjacency.has(b)) adjacency.set(b, new Set())
    adjacency.get(a).add(b)
    adjacency.get(b).add(a)
    edgeByPair.set(`${a}|${b}`, edge)
    edgeByPair.set(`${b}|${a}`, edge)
  }

  const unused = new Set(coastalEdges.map((edge) => String(edge.id)))
  const loops = []

  const getEdge = (a, b) => edgeByPair.get(`${a}|${b}`)

  while (unused.size) {
    const seedId = unused.values().next().value
    const seed = coastalEdges.find((edge) => String(edge.id) === seedId)
    if (!seed) {
      unused.delete(seedId)
      continue
    }

    const [start, next] = edgeVertexIds(seed)
    if (!start || !next) {
      unused.delete(seedId)
      continue
    }

    const vertexIds = [start, next]
    const edgeIds = [String(seed.id)]
    unused.delete(String(seed.id))

    let previous = start
    let current = next
    let safety = coastalEdges.length + 2

    while (safety-- > 0) {
      const neighbours = [...(adjacency.get(current) ?? [])]
      let chosen = null

      for (const neighbour of neighbours) {
        const edge = getEdge(current, neighbour)
        if (!edge) continue
        const edgeId = String(edge.id)
        if (unused.has(edgeId)) {
          chosen = { neighbour, edgeId }
          break
        }
      }

      if (!chosen) break
      previous = current
      current = chosen.neighbour
      vertexIds.push(current)
      edgeIds.push(chosen.edgeId)
      unused.delete(chosen.edgeId)

      if (current === start) break
      if (current === previous) break
    }

    loops.push({
      id: `coast-loop-${loops.length + 1}`,
      vertexIds,
      edgeIds,
      closed: vertexIds.length > 2 && vertexIds[0] === vertexIds[vertexIds.length - 1],
    })
  }

  return loops
}

export function classifyCoast(topology) {
  if (!topology || typeof topology !== 'object') {
    throw new TypeError('CoastTopology: topology inválida.')
  }

  const vertices = asArray(topology.vertices)
  const edges = asArray(topology.edges)

  const vertexById = new Map(vertices.map((vertex) => [String(vertex.id), vertex]))
  const coastalEdges = []
  const inlandEdges = []
  const coastalVertexIds = new Set()

  for (const edge of edges) {
    const coastal = detectBoundary(edge)
    const [a, b] = edgeVertexIds(edge)

    const enriched = {
      ...edge,
      coastal,
      edgeClass: coastal ? 'coast' : 'land-internal',
      vertexIds: a && b ? [a, b] : edge.vertexIds,
    }

    if (coastal) {
      coastalEdges.push(enriched)
      if (a) coastalVertexIds.add(a)
      if (b) coastalVertexIds.add(b)
    } else {
      inlandEdges.push(enriched)
    }
  }

  const coastalVertices = [...coastalVertexIds]
    .map((id) => vertexById.get(id))
    .filter(Boolean)
    .map((vertex) => ({ ...vertex, coastal: true }))

  const perimeterLoops = buildPerimeterLoops(coastalEdges)

  return {
    coastalEdges,
    inlandEdges,
    coastalVertices,
    coastalVertexIds: [...coastalVertexIds],
    perimeterLoops,
    stats: {
      totalEdges: edges.length,
      coastalEdges: coastalEdges.length,
      inlandEdges: inlandEdges.length,
      totalVertices: vertices.length,
      coastalVertices: coastalVertices.length,
      perimeterLoops: perimeterLoops.length,
    },
    isCoastalVertex(vertexId) {
      return coastalVertexIds.has(String(vertexId))
    },
    isCoastalEdge(edgeId) {
      return coastalEdges.some((edge) => String(edge.id) === String(edgeId))
    },
    getVertexPoint(vertexId) {
      return pointOf(vertexById.get(String(vertexId)))
    },
  }
}

export default classifyCoast
