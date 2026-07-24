/** Data civil YYYY-MM-DD no fuso America/Sao_Paulo (evita virada às 21h no UTC). */
export function saoPauloDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
