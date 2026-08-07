import { PORT_LABELS, PORT_SYMBOLS } from '../data/ports.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

function createSvg(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value == null) continue
    element.setAttribute(name, String(value))
  }
  return element
}

function point(vertex) {
  const x = Number(vertex?.x ?? vertex?.position?.x ?? vertex?.point?.x)
  const y = Number(vertex?.y ?? vertex?.position?.y ?? vertex?.point?.y)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function normalize(x, y) {
  const length = Math.hypot(x, y) || 1
  return { x: x / length, y: y / length }
}

function boardCenter(vertices) {
  const pts = vertices.map(point).filter(Boolean)
  if (!pts.length) return { x: 0, y: 0 }
  return {
    x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
    y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length,
  }
}

export class PortRenderer {
  constructor({ svg, topology, className = 'conquistador-ports' } = {}) {
    if (!svg) throw new TypeError('PortRenderer: svg é obrigatório.')
    this.svg = svg
    this.topology = topology ?? { vertices: [] }
    this.className = className
    this.layer = null
  }

  clear() {
    if (this.layer?.parentNode) this.layer.parentNode.removeChild(this.layer)
    this.layer = null
  }

  render(ports, { onPortClick = null, offset = 24 } = {}) {
    this.clear()

    const vertices = Array.isArray(this.topology?.vertices) ? this.topology.vertices : []
    const vertexById = new Map(vertices.map((vertex) => [String(vertex.id), vertex]))
    const center = boardCenter(vertices)

    const layer = createSvg('g', {
      class: this.className,
      'data-layer': 'ports',
    })

    for (const port of ports ?? []) {
      const [firstId, secondId] = port.vertexIds ?? []
      const first = point(vertexById.get(String(firstId)))
      const second = point(vertexById.get(String(secondId)))
      if (!first || !second) continue

      const mid = midpoint(first, second)
      const outward = normalize(mid.x - center.x, mid.y - center.y)
      const x = mid.x + outward.x * offset
      const y = mid.y + outward.y * offset

      const group = createSvg('g', {
        class: `conquistador-port conquistador-port--${port.type}`,
        transform: `translate(${x} ${y})`,
        role: 'button',
        tabindex: '0',
        'aria-label': `${PORT_LABELS[port.type] ?? 'Porto'} — troca ${port.give}:1`,
        'data-port-id': port.id,
      })

      const connector = createSvg('line', {
        x1: mid.x - x,
        y1: mid.y - y,
        x2: 0,
        y2: 0,
        class: 'conquistador-port__connector',
      })

      const marker = createSvg('circle', {
        cx: 0,
        cy: 0,
        r: 17,
        class: 'conquistador-port__marker',
      })

      const symbol = createSvg('text', {
        x: 0,
        y: -1,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        class: 'conquistador-port__symbol',
      })
      symbol.textContent = PORT_SYMBOLS[port.type] ?? '⚓'

      const rate = createSvg('text', {
        x: 0,
        y: 27,
        'text-anchor': 'middle',
        class: 'conquistador-port__rate',
      })
      rate.textContent = `${port.give}:1`

      group.append(connector, marker, symbol, rate)

      const activate = () => {
        if (typeof onPortClick === 'function') onPortClick(port)
      }
      group.addEventListener('click', activate)
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          activate()
        }
      })

      layer.appendChild(group)
    }

    this.svg.appendChild(layer)
    this.layer = layer
    return layer
  }
}

export default PortRenderer
