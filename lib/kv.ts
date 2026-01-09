export function stringifyStore(value: unknown): string {
  return JSON.stringify(value);
}

export function parseMaybeJSON<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  }

  return value as T;
}
