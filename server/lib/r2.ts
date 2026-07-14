export { r2Key, hashFromKey } from '../../shared/r2'
import { UPLOAD_PREFIX } from '../../shared/constants'
import type { Env } from './types'
import type { QueuedFile } from '../../shared/types'

export async function fileExists(key: string, env: Env): Promise<boolean> {
  const obj = await env.R2.head(key)
  return obj !== null
}

export async function listFiles(env: Env): Promise<QueuedFile[]> {
  const listed = await env.R2.list({ prefix: UPLOAD_PREFIX })
  return listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
  }))
}

export async function deleteFile(key: string, env: Env): Promise<void> {
  await env.R2.delete(key)
}
