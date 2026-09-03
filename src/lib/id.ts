/** Short, sortable-ish unique id. crypto.randomUUID with a timestamp prefix. */
export function newId(): string {
  const t = Date.now().toString(36)
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${t}-${r}`
}
