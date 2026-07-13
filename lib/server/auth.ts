import type { Env } from './types';

export function validateApiKey(request: Request, env: Env): boolean {
  const header = request.headers.get('Authorization');
  if (!header) return false;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1];
  const key = env.API_KEY;
  if (!key) return false;

  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ (key.charCodeAt(i) || 0);
  }
  return result === 0 && token.length === key.length;
}
