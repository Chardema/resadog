import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { prisma } from "@/lib/db/prisma";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(input: Buffer) {
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");

  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function base32Decode(input: string) {
  const normalized = input.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  let bits = "";
  for (const character of normalized) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value === -1) throw new Error("Secret TOTP invalide.");
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function getLegacyEncryptionKey() {
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!authSecret) throw new Error("Secret de chiffrement 2FA manquant.");
  return createHash("sha256").update(`2fa:${authSecret}`).digest();
}

function getEncryptionKey() {
  const configuredKey = process.env.TWO_FACTOR_ENCRYPTION_KEY?.trim();
  if (configuredKey) {
    const decoded = /^[a-f\d]{64}$/i.test(configuredKey)
      ? Buffer.from(configuredKey, "hex")
      : Buffer.from(configuredKey, "base64");
    if (decoded.length !== 32) {
      throw new Error("TWO_FACTOR_ENCRYPTION_KEY doit contenir exactement 32 octets.");
    }
    return decoded;
  }

  return getLegacyEncryptionKey();
}

function getRecoveryPepper() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant.");
  return secret;
}

function totpAt(secret: string, timestamp: number) {
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTotpSecret(payload: string) {
  const parts = payload.split(".");
  const [version, ivValue, tagValue, encryptedValue] = parts;
  if (
    parts.length !== 4 ||
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue ||
    ![ivValue, tagValue, encryptedValue].every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  ) {
    throw new Error("Secret 2FA chiffré invalide.");
  }

  const iv = Buffer.from(ivValue, "base64url");
  const tag = Buffer.from(tagValue, "base64url");
  const encrypted = Buffer.from(encryptedValue, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) {
    throw new Error("Secret 2FA chiffré invalide.");
  }

  const decryptWithKey = (key: Buffer) => {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  };

  const key = getEncryptionKey();
  try {
    return decryptWithKey(key);
  } catch (error) {
    // Existing v1 records may predate the dedicated key. AES-GCM must authenticate
    // the entire payload with the original auth-derived key before accepting it.
    if (
      !process.env.TWO_FACTOR_ENCRYPTION_KEY?.trim() ||
      !(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
    ) {
      throw error;
    }
    const legacyKey = getLegacyEncryptionKey();
    if (timingSafeEqual(key, legacyKey)) throw error;
    return decryptWithKey(legacyKey);
  }
}

export function verifyTotp(secret: string, value: string) {
  const code = value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const provided = Buffer.from(code);
  const now = Date.now();

  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(totpAt(secret, now + offset * TOTP_PERIOD_SECONDS * 1000));
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) return true;
  }
  return false;
}

export function createRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const value = randomBytes(9).toString("base64url").toUpperCase().replace(/[_-]/g, "X").slice(0, 12);
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
  });
}

export function hashRecoveryCode(userId: string, code: string) {
  return createHmac("sha256", getRecoveryPepper())
    .update(`${userId}:${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`)
    .digest("hex");
}

export async function verifySecondFactor(userId: string, value: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorRecoveryCodes: true,
    },
  });

  if (!user?.twoFactorEnabled) return false;

  if (user.twoFactorSecret && /^\d{6}$/.test(value.replace(/\s/g, ""))) {
    try {
      if (verifyTotp(decryptTotpSecret(user.twoFactorSecret), value)) return true;
    } catch (error) {
      console.error("Impossible de vérifier le secret TOTP:", error);
    }
  }

  // Recovery codes are an independent second factor, including when the stored
  // authenticator secret is missing or can no longer be decrypted.
  const recoveryHash = hashRecoveryCode(userId, value);
  const matchingHash = user.twoFactorRecoveryCodes.find((hash) => {
    const expected = Buffer.from(hash);
    const received = Buffer.from(recoveryHash);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
  if (!matchingHash) return false;

  const consumed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "User"
    SET "twoFactorRecoveryCodes" = array_remove("twoFactorRecoveryCodes", ${matchingHash}),
        "updatedAt" = NOW()
    WHERE "id" = ${userId}
      AND ${matchingHash} = ANY("twoFactorRecoveryCodes")
    RETURNING "id"
  `;
  return consumed.length === 1;
}

export function createOtpAuthUri(secret: string, email: string) {
  const label = encodeURIComponent(`La Patte Dorée:${email}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent("La Patte Dorée")}&algorithm=SHA1&digits=6&period=30`;
}
