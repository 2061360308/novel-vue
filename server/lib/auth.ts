import type { Env } from './types';

export function validateRequest(request: Request, env: Env): boolean {
  if (!env.API_KEY) return false

  const header = request.headers.get('Authorization')
  if (!header) return false
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return false

  return timingSafeEqual(m[1], env.API_KEY)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
