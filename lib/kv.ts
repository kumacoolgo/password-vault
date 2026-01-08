// Helpers to make Upstash Redis storage robust across environments.
//
// Depending on the runtime (and Upstash client settings), Redis values may be
// returned as already-deserialized objects OR as JSON strings. These helpers
// normalize that so API routes always work.

export function stringifyStore(value: unknown): string {
  return JSON.stringify(value);
}

export function parseMaybeJSON<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;

  // If Upstash returns a plain string, try to JSON.parse.
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      // Not JSON; caller can decide how to handle.
      return null;
    }
  }

  // Otherwise assume it's already an object.
  return value as T;
}
