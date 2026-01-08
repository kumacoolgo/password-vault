export function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function optionalEnv(name: string, fallback = ""): string {
  const v = process.env[name];
  return (v && v.trim()) ? v : fallback;
}

export function validateEnv(names: string[]) {
  const missing: string[] = [];
  for (const n of names) {
    const v = process.env[n];
    if (!v || !v.trim()) missing.push(n);
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
