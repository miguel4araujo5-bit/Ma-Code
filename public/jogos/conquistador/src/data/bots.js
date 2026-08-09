export const BOT_ICON = '⚙';

export const BOT_NAMES = Object.freeze([
  'Duarte',
  'Leonor',
  'Martim',
  'Beatriz',
  'Afonso',
  'Inês',
  'Gonçalo',
  'Catarina',
  'Tomé',
  'Madalena',
  'Diogo',
  'Constança',
  'Vasco',
  'Joana',
  'Lourenço',
  'Matilde',
  'Rodrigo',
  'Teresa',
  'Salvador',
  'Mariana',
]);

export function formatBotName(name) {
  return `${BOT_ICON} ${String(name || '').trim()}`.trim();
}
