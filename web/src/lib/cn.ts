/** Конкатенация классов без пустых/false — крошечная альтернатива clsx. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
