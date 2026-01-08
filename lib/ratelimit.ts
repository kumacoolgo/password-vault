import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { mustEnv, optionalInt } from "@/lib/env";

const rlRedis = new Redis({
  url: mustEnv("UPSTASH_REDIS_REST_URL"),
  token: mustEnv("UPSTASH_REDIS_REST_TOKEN"),
});

const requests = optionalInt("RATE_LIMIT_REQUESTS", 60);
const windowSeconds = optionalInt("RATE_LIMIT_WINDOW_SECONDS", 60);

export const ratelimit = new Ratelimit({
  redis: rlRedis,
  limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
  analytics: false,
  prefix: "rl:pv",
});
