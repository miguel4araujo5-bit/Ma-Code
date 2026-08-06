export const RESOURCE_IDS = Object.freeze([
  'cork',
  'stone',
  'wheat',
  'cod',
  'iron',
]);

export const RESOURCES = Object.freeze({
  cork: Object.freeze({
    id: 'cork',
    name: 'Cortiça do Montado',
    shortName: 'Cortiça',
    territoryName: 'Montado de Sobro',
    icon: '◉',
    cssClass: 'resource-cork',
  }),
  stone: Object.freeze({
    id: 'stone',
    name: 'Pedra de Cantaria',
    shortName: 'Pedra',
    territoryName: 'Pedreira',
    icon: '▰',
    cssClass: 'resource-stone',
  }),
  wheat: Object.freeze({
    id: 'wheat',
    name: 'Trigo do Alentejo',
    shortName: 'Trigo',
    territoryName: 'Planície Alentejana',
    icon: '♨',
    cssClass: 'resource-wheat',
  }),
  cod: Object.freeze({
    id: 'cod',
    name: 'Bacalhau do Atlântico',
    shortName: 'Bacalhau',
    territoryName: 'Costa Atlântica',
    icon: '≈',
    cssClass: 'resource-cod',
  }),
  iron: Object.freeze({
    id: 'iron',
    name: 'Ferro das Minas',
    shortName: 'Ferro',
    territoryName: 'Serra Mineira',
    icon: '◆',
    cssClass: 'resource-iron',
  }),
  abandoned: Object.freeze({
    id: 'abandoned',
    name: 'Terras Abandonadas',
    shortName: 'Abandonadas',
    territoryName: 'Terras Abandonadas',
    icon: '✕',
    cssClass: 'resource-abandoned',
  }),
});

export function getResource(resourceId) {
  const resource = RESOURCES[resourceId];
  if (!resource) {
    throw new Error(`Recurso desconhecido: ${resourceId}`);
  }
  return resource;
}
