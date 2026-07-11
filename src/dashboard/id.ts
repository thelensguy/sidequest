/** Central id generator so every JobEntry/AppEvent id is produced the same way. */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (shouldn't happen in
  // a modern Chrome extension, but keeps this file safe to unit test anywhere).
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
