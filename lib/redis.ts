import { Redis } from "@upstash/redis";
import { mustEnv } from "@/lib/env";

export const redis = new Redis({
  url: mustEnv("UPSTASH_REDIS_REST_URL"),
  token: mustEnv("UPSTASH_REDIS_REST_TOKEN"),
});
