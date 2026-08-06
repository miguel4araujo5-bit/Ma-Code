function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  constructor(seed = 'CONQ-DEFAULT') {
    this.seed = String(seed).trim() || 'CONQ-DEFAULT';
    this.state = hashString(this.seed) || 0x6d2b79f5;
  }

  next() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`Intervalo inteiro inválido: ${min}–${max}`);
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = this.integer(0, index);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  pick(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Não é possível escolher de uma lista vazia.');
    }
    return items[this.integer(0, items.length - 1)];
  }
}
