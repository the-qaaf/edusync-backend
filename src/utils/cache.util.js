import NodeCache from 'node-cache';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;
const memoryCache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

// Initialize Redis if configured (Ideal for Vercel/Serverless/Production)
if (process.env.REDIS_URL) {
  console.log("⚡️ Redis Configured. Initializing client...");
  redisClient = new Redis(process.env.REDIS_URL);

  redisClient.on('error', (err) => {
    console.error('Redis Error:', err);
  });
} else {
  console.log("⚠️ No REDIS_URL found. Using in-memory NodeCache (Not persistent in Serverless).");
}

/**
 * Returns a cached value or executes the fetcher function and caches the result.
 * Supports both Redis (Production) and NodeCache (Development).
 * @param {string} key - Cache key
 * @param {Function} fetcher - Async function to fetch data if cache miss
 * @param {number} ttl - Time to live in seconds (default 300)
 */
export const getOrFetch = async (key, fetcher, ttl = 300) => {
  try {
    // 1. Try Redis First
    if (redisClient) {
      const cached = await redisClient.get(key);
      if (cached) {
        console.log(`[REDIS HIT] ${key}`);
        return JSON.parse(cached);
      }
    }
    // 2. Try Memory Cache (Fallback)
    else {
      console.log(`[MEM CACHE MISS] ${key}`);
      const cached = memoryCache.get(key);
      if (cached) {
        console.log(`[MEM CACHE HIT] ${key}`);
        return cached;
      }
    }

    // 3. Cache Miss - Fetch Data
    console.log(`[CACHE MISS] ${key}`);
    const result = await fetcher();

    if (result !== undefined && result !== null) {
      // 4. Set Cache
      if (redisClient) {
        // Redis SETEX: key, seconds, value
        await redisClient.setex(key, ttl, JSON.stringify(result));
      } else {
        memoryCache.set(key, result, ttl);
      }
    }

    return result;

  } catch (error) {
    console.error(`Cache Error [${key}]:`, error);
    // Fail-safe: If cache fails, just return fresh data
    return await fetcher();
  }
};

// Export clients if needed elsewhere
export const cache = redisClient || memoryCache;

export const invalidateCache = async (key) => {
  if (redisClient) {
    await redisClient.del(key);
  } else {
    memoryCache.del(key);
  }
  console.log(`[CACHE INVALIDATED] ${key}`);
};
