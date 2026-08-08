const SVG_NS =
  'http://www.w3.org/2000/svg';

const backdropUrl =
  new URL(
    '../../assets/maps/spain-backdrop-v2.png',
    import.meta.url,
  ).href;

const SPAIN_IMAGE_RATIO =
  641 / 930;

let scheduled =
  false;

function getViewBox(svg) {
  const viewBox =
    svg?.viewBox?.baseVal;

  if (
    viewBox &&
    Number.isFinite(
      viewBox.width,
    ) &&
    Number.isFinite(
      viewBox.height,
    ) &&
    viewBox.width > 0 &&
    viewBox.height > 0
  ) {
    return {
      x:
        viewBox.x,

      y:
        viewBox.y,

      width:
        viewBox.width,

      height:
        viewBox.height,
    };
  }

  return null;
}

function createSvgElement(
  tag,
  attributes = {},
) {
  const element =
    document.createElementNS(
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

    element.setAttribute(
      name,
      String(value),
    );
  }

  return element;
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

  /*
   * Espanha é deliberadamente maior
   * do que a área visível do tabuleiro.
   *
   * Isso aproxima a escala visual
   * da relação Portugal / Espanha:
   *
   * Portugal ocupa a zona central.
   * Espanha surge sobretudo a Norte
   * e a Este, sendo parcialmente
   * cortada pelo próprio viewBox.
   */
  const width =
    viewBox.width *
    1.16;

  const height =
    width *
    SPAIN_IMAGE_RATIO;

  const x =
    viewBox.x +
    viewBox.width *
      0.48;

  const y =
    viewBox.y +
    viewBox.height *
      0.015;

  const image =
    createSvgElement(
      'image',
      {
        class:
          'spain-backdrop__image',

        href:
          backdropUrl,

        x,
        y,

        width,
        height,

        preserveAspectRatio:
          'xMinYMin meet',
      },
    );

  layer.appendChild(
    image,
  );

  /*
   * Espanha deve ficar:
   *
   * oceano
   * ↓
   * Espanha
   * ↓
   * decoração
   * ↓
   * Portugal / territórios
   *
   * Não interfere com qualquer
   * elemento jogável.
   */
  const decorationLayer =
    svg.querySelector(
      '.map-decoration',
    );

  if (
    decorationLayer
  ) {
    svg.insertBefore(
      layer,
      decorationLayer,
    );

    return;
  }

  const territoryLayer =
    svg.querySelector(
      '.territory-layer',
    );

  if (
    territoryLayer
  ) {
    svg.insertBefore(
      layer,
      territoryLayer,
    );

    return;
  }

  svg.appendChild(
    layer,
  );
}

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
      childList:
        true,

      subtree:
        true,
    },
  );

  scheduleRender();
}
