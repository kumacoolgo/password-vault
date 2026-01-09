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

  // 不是加密格式就当明文
  if (!isEncryptedPayload(payload)) return payload;

  // 只切前三个冒号：enc:v1:<iv>:<tag>:<ct...>
  const p2 = payload.indexOf(":", 0);
  const p3 = payload.indexOf(":", p2 + 1);
  const p4 = payload.indexOf(":", p3 + 1);
  const p5 = payload.indexOf(":", p4 + 1);

  // 任意一个不存在都认为格式不对（兼容旧/脏数据：直接返回原文）
  if (p2 < 0 || p3 < 0 || p4 < 0 || p5 < 0) return payload;

  const prefix = payload.slice(0, p3); // "enc:v1"
  if (prefix !== PREFIX) return payload;

  const ivB64 = payload.slice(p3 + 1, p4);
  const tagB64 = payload.slice(p4 + 1, p5);
  const ctB64 = payload.slice(p5 + 1);

  // 任何一段为空都视为脏数据，直接返回原文
  if (!ivB64 || !tagB64 || !ctB64) return payload;

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
  } catch (e) {
    console.error("[decryptSafe] failed:", e);
    console.error("[decryptSafe] payload:", payload);
    console.error("[ENCRYPTION_KEY length]", (process.env.ENCRYPTION_KEY ?? "").length);
    return "";
  }
}


export function isEncrypted(password: string) {
  return isEncryptedPayload(password);
}
