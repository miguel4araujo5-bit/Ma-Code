/**
 * CONQUISTADOR — Portos
 * Configuração canónica dos 9 portos da versão base.
 */

export const PORT_TYPES = Object.freeze({
  GENERAL: 'general',
  CORK: 'cork',
  STONE: 'stone',
  WHEAT: 'wheat',
  COD: 'cod',
  IRON: 'iron',
})

export const PORT_DEFINITIONS = Object.freeze([
  { id: 'port-general-1', type: PORT_TYPES.GENERAL, give: 3, receive: 1, resource: null },
  { id: 'port-cork', type: PORT_TYPES.CORK, give: 2, receive: 1, resource: 'cork' },
  { id: 'port-general-2', type: PORT_TYPES.GENERAL, give: 3, receive: 1, resource: null },
  { id: 'port-stone', type: PORT_TYPES.STONE, give: 2, receive: 1, resource: 'stone' },
  { id: 'port-general-3', type: PORT_TYPES.GENERAL, give: 3, receive: 1, resource: null },
  { id: 'port-wheat', type: PORT_TYPES.WHEAT, give: 2, receive: 1, resource: 'wheat' },
  { id: 'port-cod', type: PORT_TYPES.COD, give: 2, receive: 1, resource: 'cod' },
  { id: 'port-general-4', type: PORT_TYPES.GENERAL, give: 3, receive: 1, resource: null },
  { id: 'port-iron', type: PORT_TYPES.IRON, give: 2, receive: 1, resource: 'iron' },
])

export const PORT_LABELS = Object.freeze({
  [PORT_TYPES.GENERAL]: 'Porto Geral',
  [PORT_TYPES.CORK]: 'Porto da Cortiça',
  [PORT_TYPES.STONE]: 'Porto da Pedra',
  [PORT_TYPES.WHEAT]: 'Porto do Trigo',
  [PORT_TYPES.COD]: 'Porto do Bacalhau',
  [PORT_TYPES.IRON]: 'Porto do Ferro',
})

export const PORT_SYMBOLS = Object.freeze({
  [PORT_TYPES.GENERAL]: '⚓',
  [PORT_TYPES.CORK]: 'C',
  [PORT_TYPES.STONE]: 'P',
  [PORT_TYPES.WHEAT]: 'T',
  [PORT_TYPES.COD]: 'B',
  [PORT_TYPES.IRON]: 'F',
})

export function getPortDefinition(type) {
  if (type === PORT_TYPES.GENERAL) {
    return { type, give: 3, receive: 1, resource: null }
  }

  const match = PORT_DEFINITIONS.find((port) => port.type === type)
  return match ? { ...match } : null
}
