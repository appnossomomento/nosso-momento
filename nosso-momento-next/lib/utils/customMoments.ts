/** Espelha functions/lib/customMoments.js — ids no carrinho/resgate. */
export function buildCustomMomentId(pareamentoId: string, itemId: string): string {
  return `custom_${pareamentoId}_${itemId}`;
}

export function isCustomMomentId(id: string): boolean {
  return id.startsWith('custom_');
}
