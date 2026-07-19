import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, verifyPassword } from "./password.ts";
import { LoginRateLimiter } from "./rate-limit.ts";
import { createSessionToken, verifySessionToken } from "./session.ts";

test("passwords are stored as scrypt hashes and verified without plaintext", async () => {
  const hash = await hashPassword("uma-senha-segura");

  assert.match(hash, /^scrypt\$/);
  assert.equal(hash.includes("uma-senha-segura"), false);
  assert.equal(await verifyPassword("uma-senha-segura", hash), true);
  assert.equal(await verifyPassword("senha-incorreta", hash), false);
});

test("malformed password hashes are rejected", async () => {
  assert.equal(await verifyPassword("qualquer", "valor-invalido"), false);
});

test("signed sessions accept valid tokens and reject tampering or expiration", async () => {
  const secret = "s".repeat(32);
  const token = await createSessionToken(
    { username: "admin", role: "ADMIN", expiresAt: 2_000 },
    secret
  );

  assert.deepEqual(await verifySessionToken(token, secret, 1_000), {
    username: "admin",
    role: "ADMIN",
    expiresAt: 2_000,
  });
  assert.equal(await verifySessionToken(`${token}x`, secret, 1_000), null);
  assert.equal(await verifySessionToken(token, secret, 2_001), null);
});

test("login rate limiting blocks repeated failures and resets after success", () => {
  let now = 1_000;
  const limiter = new LoginRateLimiter({
    maxAttempts: 3,
    windowMs: 60_000,
    now: () => now,
  });

  assert.equal(limiter.canAttempt("127.0.0.1"), true);
  limiter.recordFailure("127.0.0.1");
  limiter.recordFailure("127.0.0.1");
  limiter.recordFailure("127.0.0.1");
  assert.equal(limiter.canAttempt("127.0.0.1"), false);

  limiter.reset("127.0.0.1");
  assert.equal(limiter.canAttempt("127.0.0.1"), true);

  limiter.recordFailure("127.0.0.1");
  limiter.recordFailure("127.0.0.1");
  limiter.recordFailure("127.0.0.1");
  now += 60_001;
  assert.equal(limiter.canAttempt("127.0.0.1"), true);
});
