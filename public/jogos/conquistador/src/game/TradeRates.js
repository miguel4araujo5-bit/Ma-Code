/**
 * CONQUISTADOR — TradeRates
 * Resolve a melhor taxa de comércio disponível para um jogador.
 *
 * Base: 4:1
 * Porto geral: 3:1
 * Porto especializado: 2:1 para o recurso respetivo
 * Feitoria (futuro): 2:1 para Cortiça ou Bacalhau
 */

const BASE_RATE = 4

function hasGeneralPort(ports) {
  return (ports ?? []).some((port) => port?.enabled !== false && port?.type === 'general')
}

function hasSpecializedPort(ports, resource) {
  return (ports ?? []).some(
    (port) => port?.enabled !== false && port?.resource === resource && Number(port?.give) === 2,
  )
}

function feitoriaSupports(feitoria, resource) {
  if (!feitoria || feitoria.enabled === false) return false
  return resource === 'cork' || resource === 'cod'
}

export function getBestTradeRate({ giveResource, controlledPorts = [], feitoria = null } = {}) {
  if (!giveResource) {
    throw new TypeError('TradeRates: giveResource é obrigatório.')
  }

  let rate = BASE_RATE
  let source = 'reserve'

  if (hasGeneralPort(controlledPorts)) {
    rate = 3
    source = 'general-port'
  }

  if (hasSpecializedPort(controlledPorts, giveResource)) {
    rate = 2
    source = 'specialized-port'
  }

  if (feitoriaSupports(feitoria, giveResource)) {
    rate = 2
    source = 'feitoria'
  }

  return { give: rate, receive: 1, source, giveResource }
}

export function canTrade({ playerResources, giveResource, controlledPorts = [], feitoria = null } = {}) {
  const rate = getBestTradeRate({ giveResource, controlledPorts, feitoria })
  const available = Number(playerResources?.[giveResource] ?? 0)
  return {
    allowed: Number.isFinite(available) && available >= rate.give,
    available,
    ...rate,
  }
}

export function listTradeRates({ controlledPorts = [], feitoria = null } = {}) {
  return ['cork', 'stone', 'wheat', 'cod', 'iron'].map((resource) =>
    getBestTradeRate({ giveResource: resource, controlledPorts, feitoria }),
  )
}

export const DEFAULT_TRADE_RATE = Object.freeze({ give: 4, receive: 1, source: 'reserve' })
