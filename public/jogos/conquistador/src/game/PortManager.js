import { PORT_DEFINITIONS } from '../data/ports.js'

function rotate(list, offset) {
  if (!list.length) return []
  const normalized = ((offset % list.length) + list.length) % list.length
  return list.slice(normalized).concat(list.slice(0, normalized))
}

function hashSeed(seed) {
  const text = String(seed ?? 'conquistador')
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function chooseEvenly(items, count, offset = 0) {
  if (count <= 0 || !items.length) return []
  if (items.length < count) {
    throw new Error(`PortManager: perímetro insuficiente para ${count} portos.`)
  }

  const ordered = rotate(items, offset)
  const selected = []
  const used = new Set()

  for (let index = 0; index < count; index += 1) {
    const target = Math.floor((index * ordered.length) / count)
    let candidate = target
    let safety = ordered.length

    while (safety-- > 0 && used.has(candidate)) {
      candidate = (candidate + 1) % ordered.length
    }

    used.add(candidate)
    selected.push(ordered[candidate])
  }

  return selected
}

function normalizeLoop(coast) {
  const loops = Array.isArray(coast?.perimeterLoops) ? coast.perimeterLoops : []
  if (!loops.length) return []

  const longest = [...loops].sort((a, b) => (b.edgeIds?.length ?? 0) - (a.edgeIds?.length ?? 0))[0]
  return Array.isArray(longest?.edgeIds) ? longest.edgeIds : []
}

function getEdge(coast, edgeId) {
  return coast.coastalEdges.find((edge) => String(edge.id) === String(edgeId)) ?? null
}

function edgeVertices(edge) {
  if (Array.isArray(edge?.vertexIds) && edge.vertexIds.length >= 2) {
    return edge.vertexIds.slice(0, 2).map(String)
  }
  return []
}

/**
 * Distribui 9 portos pelo perímetro de forma determinística e espaçada.
 * Cada porto ocupa uma aresta costeira e fica associado aos seus dois vértices.
 */
export function createPorts(coast, { seed = 'conquistador' } = {}) {
  if (!coast || !Array.isArray(coast.coastalEdges)) {
    throw new TypeError('PortManager: classificação costeira inválida.')
  }

  const loopEdgeIds = normalizeLoop(coast)
  const sourceEdges = loopEdgeIds.length
    ? loopEdgeIds.map((id) => getEdge(coast, id)).filter(Boolean)
    : coast.coastalEdges

  const offset = sourceEdges.length ? hashSeed(seed) % sourceEdges.length : 0
  const chosenEdges = chooseEvenly(sourceEdges, PORT_DEFINITIONS.length, offset)

  const ports = PORT_DEFINITIONS.map((definition, index) => {
    const edge = chosenEdges[index]
    const vertexIds = edgeVertices(edge)

    return {
      ...definition,
      edgeId: String(edge.id),
      vertexIds,
      coastal: true,
      enabled: true,
    }
  })

  validatePorts(ports, coast)
  return ports
}

export function validatePorts(ports, coast) {
  const errors = []

  if (!Array.isArray(ports) || ports.length !== 9) {
    errors.push('Devem existir exatamente 9 portos.')
  }

  const edgeIds = new Set()
  const ids = new Set()

  for (const port of ports ?? []) {
    if (!port?.id || ids.has(port.id)) errors.push(`ID de porto inválido/duplicado: ${port?.id ?? 'sem-id'}.`)
    ids.add(port?.id)

    if (!port?.edgeId || edgeIds.has(String(port.edgeId))) {
      errors.push(`Aresta de porto inválida/duplicada: ${port?.edgeId ?? 'sem-aresta'}.`)
    }
    edgeIds.add(String(port?.edgeId))

    if (!coast?.isCoastalEdge?.(port?.edgeId)) {
      errors.push(`O porto ${port?.id} não está numa aresta costeira.`)
    }

    if (!Array.isArray(port?.vertexIds) || port.vertexIds.length !== 2) {
      errors.push(`O porto ${port?.id} deve estar associado a dois vértices.`)
    }
  }

  if (errors.length) {
    throw new Error(`PortManager: ${errors.join(' ')}`)
  }

  return true
}

export function playerControlledPorts(ports, playerId, topology) {
  if (!playerId) return []
  const vertices = Array.isArray(topology?.vertices) ? topology.vertices : []
  const ownerByVertex = new Map(
    vertices.map((vertex) => [String(vertex.id), String(vertex.ownerId ?? vertex.owner ?? '')]),
  )

  return (ports ?? []).filter((port) =>
    port.vertexIds.some((vertexId) => ownerByVertex.get(String(vertexId)) === String(playerId)),
  )
}

export default createPorts
