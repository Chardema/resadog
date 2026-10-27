import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual implementation with synthetic keys and an in-memory database.
// This check never loads environment files, connects to production, or prints codes.
type TestUser = {
  id: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorRecoveryCodes: string[];
};
type TwoFactor = typeof import("../src/lib/auth/two-factor");
const requireReal = createRequire(import.meta.url);
const env: Record<string, string | undefined> = {
  AUTH_SECRET: "synthetic-auth-secret-for-two-factor-regression-checks",
};
let now = 1_234_567_890_000;
let user: TestUser | null = null;
let recoveryWrites = 0;
let decryptionErrors = 0;
const prisma = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      user?.id === where.id ? structuredClone(user) : null,
  },
  $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Model the conditional UPDATE atomically, including two stale readers racing.
    const sql = strings.join("?");
    assert.match(sql, /array_remove\("twoFactorRecoveryCodes", \?\)/);
    assert.match(sql, /AND \? = ANY\("twoFactorRecoveryCodes"\)/);
    const [hash, userId, conditionHash] = values;
    assert.equal(hash, conditionHash);
    assert.equal(typeof hash, "string");
    if (!user || user.id !== userId || !user.twoFactorRecoveryCodes.includes(hash as string)) {
      return [];
    }
    user.twoFactorRecoveryCodes = user.twoFactorRecoveryCodes.filter((value) => value !== hash);
    recoveryWrites++;
    return [{ id: user.id }];
  },
};
const source = ts.transpileModule(fs.readFileSync("src/lib/auth/two-factor.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const twoFactor = {} as TwoFactor;
vm.runInNewContext(source, {
  exports: twoFactor,
  require: (id: string) => {
    if (id === "@/lib/db/prisma") return { prisma };
    if (id === "crypto") return requireReal("node:crypto");
    throw new Error(`Unexpected dependency in isolated 2FA check: ${id}`);
  },
  Buffer,
  Date: class extends Date {
    static now() { return now; }
  },
  process: { env },
  console: { error: () => { decryptionErrors++; } },
});

const referenceSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const primaryKey = "1".repeat(64);
const unrelatedKey = "2".repeat(64);
const recoveryCode = "TEST-ONLY-1234";
const userId = "synthetic-user";
const referenceTime = 1_234_567_890_000;
const referenceCode = "005924";

function setUser(secret: string | null, enabled = true) {
  user = {
    id: userId,
    twoFactorEnabled: enabled,
    twoFactorSecret: secret,
    twoFactorRecoveryCodes: [twoFactor.hashRecoveryCode(userId, recoveryCode)],
  };
}

function tamper(payload: string, index: number) {
  const parts = payload.split(".");
  const bytes = Buffer.from(parts[index], "base64url");
  bytes[0] ^= 1;
  parts[index] = bytes.toString("base64url");
  return parts.join(".");
}

async function main() {
  // RFC 6238 SHA1 reference outputs, truncated to the application's six digits.
  for (const [seconds, code] of [
    [59, "287082"],
    [1_111_111_109, "081804"],
    [1_111_111_111, "050471"],
    [1_234_567_890, "005924"],
    [2_000_000_000, "279037"],
    [20_000_000_000, "353130"],
  ] as const) {
    now = seconds * 1000;
    assert.equal(twoFactor.verifyTotp(referenceSecret, code), true, "RFC reference code");
  }
  for (const drift of [-30_000, 0, 30_000]) {
    now = referenceTime + drift;
    assert.equal(twoFactor.verifyTotp(referenceSecret, referenceCode), true, "allowed clock window");
  }
  for (const drift of [-60_000, 60_000]) {
    now = referenceTime + drift;
    assert.equal(twoFactor.verifyTotp(referenceSecret, referenceCode), false, "expired/future code");
  }
  now = referenceTime;
  assert.equal(twoFactor.verifyTotp(referenceSecret, " 005 924 "), true);
  for (const malformed of ["", "00592", "0059240", "005-924", "ABCDEF", "000000"]) {
    assert.equal(twoFactor.verifyTotp(referenceSecret, malformed), false);
  }
  assert.equal(twoFactor.verifyTotp("JBSWY3DPEHPK3PXP", referenceCode), false, "wrong secret");

  const authSecret = env.AUTH_SECRET!;
  const legacyPayload = twoFactor.encryptTotpSecret(referenceSecret);
  assert.equal(twoFactor.decryptTotpSecret(legacyPayload), referenceSecret);

  // This is the production incident: a dedicated key is added after enrollment.
  env.TWO_FACTOR_ENCRYPTION_KEY = primaryKey;
  assert.equal(twoFactor.decryptTotpSecret(legacyPayload), referenceSecret, "legacy fallback after key introduction");
  setUser(legacyPayload);
  assert.equal(await twoFactor.verifySecondFactor(userId, referenceCode), true);
  assert.equal(recoveryWrites, 0, "TOTP login does not consume recovery codes");

  const currentPayload = twoFactor.encryptTotpSecret(referenceSecret);
  assert.equal(twoFactor.decryptTotpSecret(currentPayload), referenceSecret);
  env.AUTH_SECRET = "different-synthetic-auth-secret";
  assert.equal(twoFactor.decryptTotpSecret(currentPayload), referenceSecret, "dedicated encryption independent of auth secret");
  assert.throws(() => twoFactor.decryptTotpSecret(legacyPayload), "unknown legacy key must reject");
  env.AUTH_SECRET = authSecret;
  env.TWO_FACTOR_ENCRYPTION_KEY = unrelatedKey;
  assert.throws(() => twoFactor.decryptTotpSecret(currentPayload), "unrelated dedicated key must reject");
  assert.equal(twoFactor.decryptTotpSecret(legacyPayload), referenceSecret);
  env.TWO_FACTOR_ENCRYPTION_KEY = primaryKey;

  // NEXTAUTH_SECRET was the legacy fallback when AUTH_SECRET was absent.
  delete env.AUTH_SECRET;
  env.NEXTAUTH_SECRET = authSecret;
  assert.equal(twoFactor.decryptTotpSecret(legacyPayload), referenceSecret);
  delete env.NEXTAUTH_SECRET;
  assert.equal(twoFactor.decryptTotpSecret(currentPayload), referenceSecret, "dedicated key needs no legacy fallback");
  assert.throws(() => twoFactor.decryptTotpSecret(legacyPayload));
  env.AUTH_SECRET = authSecret;
  env.NEXTAUTH_SECRET = "different-ignored-synthetic-secret";
  assert.equal(twoFactor.decryptTotpSecret(legacyPayload), referenceSecret, "AUTH_SECRET precedence remains unchanged");
  delete env.NEXTAUTH_SECRET;

  env.TWO_FACTOR_ENCRYPTION_KEY = createHash("sha256").update(`2fa:${authSecret}`).digest("hex");
  assert.equal(twoFactor.decryptTotpSecret(legacyPayload), referenceSecret, "identical primary and legacy key");
  assert.throws(() => twoFactor.decryptTotpSecret(tamper(legacyPayload, 2)));
  env.TWO_FACTOR_ENCRYPTION_KEY = Buffer.from(primaryKey, "hex").toString("base64");
  assert.equal(twoFactor.decryptTotpSecret(currentPayload), referenceSecret, "base64 configured key");
  env.TWO_FACTOR_ENCRYPTION_KEY = "invalid";
  assert.throws(() => twoFactor.encryptTotpSecret(referenceSecret));
  assert.throws(() => twoFactor.decryptTotpSecret(legacyPayload), "malformed primary configuration fails closed");
  env.TWO_FACTOR_ENCRYPTION_KEY = primaryKey;

  for (const payload of [legacyPayload, currentPayload]) {
    for (const index of [1, 2, 3]) {
      assert.throws(() => twoFactor.decryptTotpSecret(tamper(payload, index)), "tampered payload must reject");
    }
    for (const malformed of [
      "", "v1", payload.replace(/^v1/, "v2"), `${payload}.extra`,
      payload.replace(/\.[^.]+\./, ".AA."), payload.replace(/\.[^.]+$/, "."),
      `${payload}!`,
    ]) {
      assert.throws(() => twoFactor.decryptTotpSecret(malformed), "invalid payload format");
    }
  }

  for (const secret of [currentPayload, legacyPayload, "corrupt", null]) {
    setUser(secret);
    const before: number = recoveryWrites;
    assert.equal(await twoFactor.verifySecondFactor(userId, "WRNG-CODE-0000"), false);
    assert.equal(await twoFactor.verifySecondFactor(userId, "000000"), false);
    assert.equal(recoveryWrites, before, "invalid code does not consume recovery codes");
    assert.equal(await twoFactor.verifySecondFactor(userId, "test only 1234"), true);
    assert.equal(await twoFactor.verifySecondFactor(userId, recoveryCode), false, "recovery replay rejected");
    assert.equal(recoveryWrites, before + 1);
  }

  setUser("corrupt");
  const beforeErrors = decryptionErrors;
  assert.equal(await twoFactor.verifySecondFactor(userId, referenceCode), false);
  assert.equal(decryptionErrors, beforeErrors + 1, "corrupt TOTP is reported without exposing it");
  assert.equal(await twoFactor.verifySecondFactor(userId, recoveryCode), true);

  setUser(currentPayload);
  const concurrentResults = await Promise.all([
    twoFactor.verifySecondFactor(userId, recoveryCode),
    twoFactor.verifySecondFactor(userId, recoveryCode),
  ]);
  assert.equal(concurrentResults.filter(Boolean).length, 1, "atomic recovery consumption under race");
  setUser(currentPayload, false);
  assert.equal(await twoFactor.verifySecondFactor(userId, referenceCode), false, "disabled MFA rejects TOTP");
  assert.equal(await twoFactor.verifySecondFactor(userId, recoveryCode), false, "disabled MFA rejects recovery");
  user = null;
  assert.equal(await twoFactor.verifySecondFactor(userId, recoveryCode), false, "missing account rejects");

  console.log("OK — 2FA reference vectors, clock window, legacy/dedicated key transition, authenticated tamper rejection, and atomic single-use recovery. Synthetic keys and in-memory database only.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
