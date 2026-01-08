import crypto from "crypto";
import { mustEnv } from "@/lib/env";

// ENCRYPTION_KEY: base64 of 32 random bytes (recommended), OR 64-hex chars.
function getKey(): Buffer {
  const raw = mustEnv("ENCRYPTION_KEY");

  // base64 (most common)
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {}

  // hex
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  throw new Error("ENCRYPTION_KEY must be 32-byte base64 or 64-hex characters");
}

// Current format: enc:v1:<iv_b64>:<tag_b64>:<cipher_b64>
const PREFIX = "enc:v1";

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt(payload: string): string {
  if (!payload) return "";
  if (!payload.startsWith(PREFIX)) {
    // Backward compatibility: old plaintext data in Redis
    return payload;
  }

  // Normal format: enc:v1:<iv>:<tag>:<ct>
  const parts = payload.split(":");
  if (parts.length === 4) {
    const [, ivB64, tagB64, ctB64] = parts;
    return decryptParts(ivB64, tagB64, ctB64);
  }

  // Legacy (buggy) format from earlier patch:
  // "enc:v1:" + ivB64 + tagB64 + ctB64  (no ':' separators)
  // We can recover by fixed lengths:
  // iv is 12 bytes => base64 length 16
  // tag is 16 bytes => base64 length 24
  const legacyPrefix = `${PREFIX}:`;
  if (payload.startsWith(legacyPrefix)) {
    const rest = payload.slice(legacyPrefix.length);
    if (rest.length >= 40) {
      const ivB64 = rest.slice(0, 16);
      const tagB64 = rest.slice(16, 40);
      const ctB64 = rest.slice(40);
      return decryptParts(ivB64, tagB64, ctB64);
    }
  }

  // If still unrecognized, return as-is to avoid hard failure
  // (better to show something than crash the whole list)
  return payload;
}

function decryptParts(ivB64: string, tagB64: string, ctB64: string): string {
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
