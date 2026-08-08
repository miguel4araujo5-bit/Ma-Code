import {
  PORT_LABELS,
  PORT_SYMBOLS,
} from '../data/ports.js';

const SVG_NS =
  'http://www.w3.org/2000/svg';

function createSvg(
  tag,
  attributes = {},
) {
  const element =
    document.createElementNS(
      SVG_NS,
      tag,
    );

  for (
    const [name, value]
    of Object.entries(attributes)
  ) {
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

function point(vertex) {
  const x = Number(
    vertex?.x ??
    vertex?.position?.x ??
    vertex?.point?.x,
  );

  const y = Number(
    vertex?.y ??
    vertex?.position?.y ??
    vertex?.point?.y,
  );

  return (
    Number.isFinite(x) &&
    Number.isFinite(y)
  )
    ? { x, y }
    : null;
}

function midpoint(
  first,
  second,
) {
  return {
    x:
      (first.x + second.x) /
      2,

    y:
      (first.y + second.y) /
      2,
  };
}

function normalize(
  x,
  y,
) {
  const length =
    Math.hypot(x, y) || 1;

  return {
    x:
      x / length,

    y:
      y / length,
  };
}

function boardCenter(
  points,
) {
  if (!points.length) {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x:
      points.reduce(
        (sum, current) =>
          sum + current.x,
        0,
      ) /
      points.length,

    y:
      points.reduce(
        (sum, current) =>
          sum + current.y,
        0,
      ) /
      points.length,
  };
}

/*
 * Calcula uma normal verdadeira à aresta.
 *
 * Existem sempre duas normais possíveis.
 * Escolhemos aquela que aponta para fora
 * do centro do tabuleiro.
 *
 * Isto é importante porque simplesmente
 * usar "midpoint - center" pode deslocar
 * o Porto na direção de um dos vértices
 * quando a aresta é diagonal.
 */
function outwardNormal(
  first,
  second,
  center,
) {
  const dx =
    second.x -
    first.x;

  const dy =
    second.y -
    first.y;

  const mid =
    midpoint(
      first,
      second,
    );

  const normalA =
    normalize(
      -dy,
      dx,
    );

  const normalB = {
    x:
      -normalA.x,

    y:
      -normalA.y,
  };

  const outwardVector = {
    x:
      mid.x -
      center.x,

    y:
      mid.y -
      center.y,
  };

  const scoreA =
    normalA.x *
      outwardVector.x +
    normalA.y *
      outwardVector.y;

  const scoreB =
    normalB.x *
      outwardVector.x +
    normalB.y *
      outwardVector.y;

  return scoreA >= scoreB
    ? normalA
    : normalB;
}

export class PortRenderer {
  constructor({
    svg,
    topology,
    className =
      'conquistador-ports',

    projectPoint =
      null,
  } = {}) {
    if (!svg) {
      throw new TypeError(
        'PortRenderer: svg é obrigatório.',
      );
    }

    this.svg =
      svg;

    this.topology =
      topology ?? {
        vertices: [],
      };

    this.className =
      className;

    this.projectPoint =
      typeof projectPoint ===
      'function'
        ? projectPoint
        : null;

    this.layer =
      null;
  }

  project(vertex) {
    const rawPoint =
      point(vertex);

    if (!rawPoint) {
      return null;
    }

    if (!this.projectPoint) {
      return rawPoint;
    }

    const projected =
      this.projectPoint(
        rawPoint,
        vertex,
      );

    if (
      !projected ||
      !Number.isFinite(
        Number(projected.x),
      ) ||
      !Number.isFinite(
        Number(projected.y),
      )
    ) {
      return null;
    }

    return {
      x:
        Number(
          projected.x,
        ),

      y:
        Number(
          projected.y,
        ),
    };
  }

  clear() {
    if (
      this.layer
        ?.parentNode
    ) {
      this.layer
        .parentNode
        .removeChild(
          this.layer,
        );
    }

    this.layer =
      null;
  }

  render(
    ports,
    {
      onPortClick =
        null,

      /*
       * 38px afasta suficientemente
       * o marcador da aresta e dos
       * vértices de Vila.
       */
      offset = 38,
    } = {},
  ) {
    this.clear();

    const vertices =
      Array.isArray(
        this.topology?.vertices,
      )
        ? this.topology.vertices
        : [];

    const vertexById =
      new Map(
        vertices.map(
          (vertex) => [
            String(vertex.id),
            vertex,
          ],
        ),
      );

    const projectedPoints =
      vertices
        .map(
          (vertex) =>
            this.project(vertex),
        )
        .filter(Boolean);

    const center =
      boardCenter(
        projectedPoints,
      );

    const layer =
      createSvg(
        'g',
        {
          class:
            this.className,

          'data-layer':
            'ports',

          'aria-label':
            'Portos do Reino',
        },
      );

    for (
      const port
      of ports ?? []
    ) {
      const [
        firstId,
        secondId,
      ] =
        port.vertexIds ??
        [];

      const first =
        this.project(
          vertexById.get(
            String(firstId),
          ),
        );

      const second =
        this.project(
          vertexById.get(
            String(secondId),
          ),
        );

      if (
        !first ||
        !second
      ) {
        continue;
      }

      const mid =
        midpoint(
          first,
          second,
        );

      /*
       * Em vez de empurrar o Porto
       * radialmente a partir do centro
       * do tabuleiro, usamos a normal
       * perpendicular à própria aresta.
       */
      const outward =
        outwardNormal(
          first,
          second,
          center,
        );

      const x =
        mid.x +
        outward.x *
          offset;

      const y =
        mid.y +
        outward.y *
          offset;

      const group =
        createSvg(
          'g',
          {
            class:
              `conquistador-port conquistador-port--${port.type}`,

            transform:
              `translate(${x} ${y})`,

            role:
              'img',

            'aria-label':
              `${PORT_LABELS[port.type] ?? 'Porto'} — troca ${port.give}:1`,

            'data-port-id':
              port.id,

            'data-port-edge-id':
              port.edgeId,
          },
        );

      const title =
        createSvg(
          'title',
        );

      title.textContent =
        `${PORT_LABELS[port.type] ?? 'Porto'} — troca ${port.give}:1`;

      /*
       * Liga visualmente o Porto
       * ao centro exato da aresta.
       */
      const connector =
        createSvg(
          'line',
          {
            x1:
              mid.x -
              x,

            y1:
              mid.y -
              y,

            x2: 0,
            y2: 0,

            class:
              'conquistador-port__connector',
          },
        );

      const outerMarker =
        createSvg(
          'circle',
          {
            cx: 0,
            cy: 0,

            r: 18,

            class:
              'conquistador-port__marker-outer',
          },
        );

      const marker =
        createSvg(
          'circle',
          {
            cx: 0,
            cy: 0,

            r: 14.5,

            class:
              'conquistador-port__marker',
          },
        );

      const symbol =
        createSvg(
          'text',
          {
            x: 0,
            y: -1,

            'text-anchor':
              'middle',

            'dominant-baseline':
              'central',

            class:
              'conquistador-port__symbol',
          },
        );

      symbol.textContent =
        PORT_SYMBOLS[
          port.type
        ] ?? '⚓';

      const rate =
        createSvg(
          'text',
          {
            x: 0,
            y: 29,

            'text-anchor':
              'middle',

            class:
              'conquistador-port__rate',
          },
        );

      rate.textContent =
        `${port.give}:1`;

      group.append(
        title,
        connector,
        outerMarker,
        marker,
        symbol,
        rate,
      );

      /*
       * Mantemos o callback por compatibilidade
       * futura, embora a camada esteja atualmente
       * com pointer-events:none no CSS.
       */
      if (
        typeof onPortClick ===
        'function'
      ) {
        group.addEventListener(
          'click',
          () => {
            onPortClick(port);
          },
        );
      }

      layer.appendChild(
        group,
      );
    }

    this.svg.appendChild(
      layer,
    );

    this.layer =
      layer;

    return layer;
  }
}

export default PortRenderer;
