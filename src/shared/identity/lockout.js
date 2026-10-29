// Short-lived counters in Redis: sign-in lockouts, wrong-code limits and resend cooldowns. Keys carry the client's
// key prefix (core/redis), so they are namespaced per app.
const redis = require("../../core/redis/redis");
const ApiError = require("../../core/http/ApiError");
const httpStatus = require("../../core/http/status");

const tooManyRequests = (message, retryAfterSeconds) =>
  ApiError.withCode(httpStatus.TOO_MANY_REQUESTS, message, "TOO_MANY_REQUESTS", {
    retry_after_seconds: retryAfterSeconds,
  });

// Throws while `key` holds `maxFailures` or more failures. The lock ends when the key expires.
const assertNotLocked = async (key, maxFailures, message) => {
  const failures = Number(await redis.get(key)) || 0;
  if (failures >= maxFailures) {
    throw tooManyRequests(message, Math.max(await redis.ttl(key), 1));
  }
};

// Counts one failure. The first failure starts the window, so the lock lasts `windowSeconds` from it.
const recordFailure = async (key, windowSeconds) => {
  const failures = await redis.incr(key);
  if (failures === 1) await redis.expire(key, windowSeconds);
  return failures;
};

const clearFailures = (key) => redis.del(key);

// A new one-time code is refused until the cooldown key expires.
const assertCooldown = async (key) => {
  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    throw tooManyRequests(`Please wait ${ttl} seconds before requesting another code.`, ttl);
  }
};

const startCooldown = (key, seconds) => redis.set(key, "1", "EX", seconds);

module.exports = {
  tooManyRequests,
  assertNotLocked,
  recordFailure,
  clearFailures,
  assertCooldown,
  startCooldown,
};
