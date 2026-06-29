/** Máximo de conexões ativas para usuários VIP (free = 1). */
export const MAX_CONEXOES_VIP = 5;

export const MAX_CONEXOES_FREE = 1;

export function getConnectionLimit(isVip: boolean): number {
  return isVip ? MAX_CONEXOES_VIP : MAX_CONEXOES_FREE;
}
