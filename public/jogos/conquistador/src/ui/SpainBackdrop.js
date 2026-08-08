const SVG_NS = 'http://www.w3.org/2000/svg';

const backdropUrl = new URL(
  '../../assets/maps/spain-backdrop.png',
  import.meta.url,
).href;

let scheduled = false;

function getViewBox(svg) {
  const viewBox = svg?.viewBox?.baseVal;

  if (
    viewBox &&
    Number.isFinite(viewBox.width) &&
    Number.isFinite(viewBox.height) &&
    viewBox.width > 0 &&
    viewBox.height > 0
  ) {
    return {
      x: viewBox.x,
      y: viewBox.y,
      width: viewBox.width,
      height: viewBox.height,
    };
  }

  return null;
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value == null) continue;
    element.setAttribute(name, String(value));
  }

  return element;
}

function renderSpainBackdrop() {
  const svg = document.querySelector('.board-svg');
  if (!svg) return;

  const viewBox = getViewBox(svg);
  if (!viewBox) return;

  svg
    .querySelector('[data-layer="spain-backdrop"]')
    ?.remove();

  const layer = createSvgElement('g', {
    class: 'spain-backdrop',
    'data-layer': 'spain-backdrop',
    'aria-hidden': 'true',
  });

  /*
   * A massa espanhola ocupa sobretudo a zona a Este e a Norte.
   * Portugal continua a ser desenhado por cima desta imagem.
   * Estes valores são relativos ao viewBox para se manterem estáveis
   * em desktop e em ecrãs menores.
   */
  const width = viewBox.width * 0.57;
  const height = viewBox.height * 0.67;
  const x = viewBox.x + viewBox.width * 0.47;
  const y = viewBox.y + viewBox.height * 0.055;

  const image = createSvgElement('image', {
    class: 'spain-backdrop__image',
    href: backdropUrl,
    x,
    y,
    width,
    height,
    preserveAspectRatio: 'xMidYMid meet',
  });

  layer.appendChild(image);

  /*
   * Colocamos Espanha antes da decoração existente para que a rosa
   * dos ventos e "OCEANO ATLÂNTICO" continuem sempre por cima.
   */
  const decorationLayer = svg.querySelector('.map-decoration');

  if (decorationLayer) {
    svg.insertBefore(layer, decorationLayer);
  } else {
    const territoryLayer = svg.querySelector('.territory-layer');

    if (territoryLayer) {
      svg.insertBefore(layer, territoryLayer);
    } else {
      svg.appendChild(layer);
    }
  }
}

function scheduleRender() {
  if (scheduled) return;

  scheduled = true;

  requestAnimationFrame(() => {
    scheduled = false;
    renderSpainBackdrop();
  });
}

const app = document.querySelector('#app');

if (app) {
  new MutationObserver(scheduleRender).observe(app, {
    childList: true,
    subtree: true,
  });

  scheduleRender();
}
