/**
 * CONQUISTADOR — linha costeira oficial da Portugal Mainland Mask v2.
 *
 * Os índices de lado seguem a ordem dos edgeIds de cada hexágono:
 * 0 = Este
 * 1 = Sudeste
 * 2 = Sudoeste
 * 3 = Oeste
 * 4 = Noroeste
 * 5 = Nordeste
 *
 * Isto distingue a verdadeira costa marítima da fronteira terrestre
 * do perímetro do mapa. Não altera a geometria dos 19 territórios.
 */

export const COASTLINE_MASK_VERSION = 2;
export const EXPECTED_MARITIME_EDGE_COUNT = 21;

const DEFINITIONS = Object.freeze({
  PT01: Object.freeze({
    coast: 'atlantic',
    sides: Object.freeze([2, 3]),
  }),
  PT04: Object.freeze({
    coast: 'atlantic',
    sides: Object.freeze([2, 3]),
  }),
  PT07: Object.freeze({
    coast: 'atlantic',
    sides: Object.freeze([3]),
  }),
  PT09: Object.freeze({
    coast: 'atlantic',
    sides: Object.freeze([3, 4]),
  }),
  PT11: Object.freeze({
    coast: 'atlantic',
    sides: Object.freeze([2, 3, 4]),
  }),
  PT13: Object.freeze({
    coast: 'atlantic',
    sides: Object.freeze([2, 3]),
  }),
  PT15: Object.freeze({
    coast: 'atlantic',
    sides: Object.freeze([3]),
  }),
  PT17: Object.freeze({
    coast: 'atlantic-algarve',
    sides: Object.freeze([1, 2, 3, 4]),
  }),
  PT18: Object.freeze({
    coast: 'algarve',
    sides: Object.freeze([1, 2]),
  }),
  PT19: Object.freeze({
    coast: 'algarve',
    sides: Object.freeze([1, 2]),
  }),
});

export function maritimeSidesForSlot(slotId) {
  return DEFINITIONS[String(slotId)]?.sides ?? [];
}

export function isMaritimeSide(slotId, sideIndex) {
  return maritimeSidesForSlot(slotId).includes(Number(sideIndex));
}

export function coastTypeForSlot(slotId) {
  return DEFINITIONS[String(slotId)]?.coast ?? null;
}

export function isMaritimeSlot(slotId) {
  return maritimeSidesForSlot(slotId).length > 0;
}

export const COASTLINE_DEFINITIONS = DEFINITIONS;
