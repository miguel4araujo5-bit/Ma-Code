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
    document
      .createElementNS(
        SVG_NS,
        tag,
      );

  for (
    const [
      name,
      value,
    ]
    of Object.entries(
      attributes,
    )
  ) {
    if (
      value == null
    ) {
      continue;
    }

    element
      .setAttribute(
        name,
        String(value),
      );
  }

  return element;
}

function point(
  vertex,
) {
  const x =
    Number(
      vertex?.x ??
      vertex
        ?.position
        ?.x ??
      vertex
        ?.point
        ?.x,
    );

  const y =
    Number(
      vertex?.y ??
      vertex
        ?.position
        ?.y ??
      vertex
        ?.point
        ?.y,
    );

  return (
    Number.isFinite(x) &&
    Number.isFinite(y)
  )
    ? {
        x,
        y,
      }
    : null;
}

function midpoint(
  first,
  second,
) {
  return {
    x:
      (
        first.x +
        second.x
      ) / 2,

    y:
      (
        first.y +
        second.y
      ) / 2,
  };
}

function normalize(
  x,
  y,
) {
  const length =
    Math.hypot(
      x,
      y,
    ) || 1;

  return {
    x:
      x /
      length,

    y:
      y /
      length,
  };
}

function boardCenter(
  points,
) {
  if (
    !points.length
  ) {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x:
      points.reduce(
        (
          sum,
          current,
        ) =>
          sum +
          current.x,
        0,
      ) /
      points.length,

    y:
      points.reduce(
        (
          sum,
          current,
        ) =>
          sum +
          current.y,
        0,
      ) /
      points.length,
  };
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

  project(
    vertex,
  ) {
    const rawPoint =
      point(
        vertex,
      );

    if (
      !rawPoint
    ) {
      return null;
    }

    if (
      !this.projectPoint
    ) {
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
        Number(
          projected.x,
        ),
      ) ||
      !Number.isFinite(
        Number(
          projected.y,
        ),
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

      offset = 27,
    } = {},
  ) {
    this.clear();

    const vertices =
      Array.isArray(
        this
          .topology
          ?.vertices,
      )
        ? this
            .topology
            .vertices
        : [];

    const vertexById =
      new Map(
        vertices.map(
          (vertex) => [
            String(
              vertex.id,
            ),

            vertex,
          ],
        ),
      );

    const projectedPoints =
      vertices
        .map(
          (vertex) =>
            this.project(
              vertex,
            ),
        )
        .filter(
          Boolean,
        );

    const center =
      boardCenter(
        projectedPoints,
      );

    const layer =
      createSvg(
        'g',
        {
          class:
            this
              .className,

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
        port
          .vertexIds ??
        [];

      const first =
        this.project(
          vertexById.get(
            String(
              firstId,
            ),
          ),
        );

      const second =
        this.project(
          vertexById.get(
            String(
              secondId,
            ),
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

      const outward =
        normalize(
          mid.x -
            center.x,

          mid.y -
            center.y,
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
              'button',

            tabindex:
              '0',

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

      const activate =
        () => {
          if (
            typeof onPortClick ===
            'function'
          ) {
            onPortClick(
              port,
            );
          }
        };

      group
        .addEventListener(
          'click',
          activate,
        );

      group
        .addEventListener(
          'keydown',
          (event) => {
            if (
              event.key ===
                'Enter' ||
              event.key ===
                ' '
            ) {
              event
                .preventDefault();

              activate();
            }
          },
        );

      layer
        .appendChild(
          group,
        );
    }

    this.svg
      .appendChild(
        layer,
      );

    this.layer =
      layer;

    return layer;
  }
}

export default PortRenderer;
