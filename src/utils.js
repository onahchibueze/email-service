import Redis from "ioredis";
import pino from "pino";

export const logger = pino({ level: "info" });
export const redis = new Redis(process.env.REDIS_URL);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isDuplicate = async (requestId) => {
  const key = `idempotency:${requestId}`;

  // Use the instance, not the class
  const exists = await redis.get(key);
  if (exists) {
    return true;
  }

  await redis.set(key, "1", "EX", 24 * 60 * 60); // Set key with 24 hours expiration
  return false;
};
