import crypto from "crypto";
import { mustEnv } from "@/lib/env";

/**
 * AES-256-GCM encryption helper.
 * Storage format: enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 */

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = mustEnv("ENCRYPTION_KEY").trim();

  // 32-byte base64
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return (cachedKey = b);
  } catch {
    // ignore
  }

  // 64-hex
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return (cachedKey = Buffer.from(raw, "hex"));

  throw new Error("ENCRYPTION_KEY must be 32-byte base64 or 64-hex characters");
}

const PREFIX = "enc:v1";

function isEncryptedPayload(s: string) {
  return !!s && s.startsWith(PREFIX + ":");
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";

  // Guard: avoid double-encrypting if callers accidentally pass encrypted text.
  if (isEncryptedPayload(plaintext)) {
    throw new Error("Refusing to encrypt an already-encrypted payload");
  }

  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

function decryptOnce(payload: string): string {
  if (!payload) return "";
  if (!isEncryptedPayload(payload)) return payload;

  const parts = payload.split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted payload format");
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getKey();

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Decrypt repeatedly in case older code accidentally double-encrypted.
 * Depth is capped to avoid infinite loops.
 */
export function decrypt(payload: string): string {
  let out = payload ?? "";
  for (let i = 0; i < 3; i++) {
    if (!isEncryptedPayload(out)) break;
    out = decryptOnce(out);
  }
  return out;
}

export function decryptSafe(payload: string): string {
  try {
    return decrypt(payload);
  } catch {
    return "";
  }
}

export function isEncrypted(password: string) {
  return isEncryptedPayload(password);
}
