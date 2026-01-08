import crypto from "crypto";
import { mustEnv } from "@/lib/env";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = mustEnv("ENCRYPTION_KEY").trim();

  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return (cachedKey = b);
  } catch {}

  if (/^[0-9a-fA-F]{64}$/.test(raw)) return (cachedKey = Buffer.from(raw, "hex"));

  throw new Error("ENCRYPTION_KEY must be 32-byte base64 or 64-hex characters");
}

const PREFIX = "enc:v1";

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt(payload: string): string {
  if (!payload) return "";
  if (!payload.startsWith(PREFIX + ":")) return payload;
  const parts = payload.split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted payload format");
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
