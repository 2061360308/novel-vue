import type { Env } from './types';
import { isActionRunning as checkRunning } from './github';

let cache: { running: boolean; ts: number } | null = null;

export async function isActionRunning(env: Env): Promise<boolean> {
  const ttl = parseInt(env.CACHE_TTL, 10) || 15;
  const now = Date.now();
  if (cache && (now - cache.ts) < ttl * 1000) return cache.running;

  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN } = env;
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) return false;

  try {
    const running = await checkRunning({ GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN });
    cache = { running, ts: now };
    return running;
  } catch {
    return false;
  }
}
