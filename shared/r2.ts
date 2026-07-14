import { AwsClient } from 'aws4fetch'
import { UPLOAD_PREFIX } from './constants'

export interface R2ClientOptions {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export function createR2Client(opts: R2ClientOptions) {
  const client = new AwsClient({
    accessKeyId: opts.accessKeyId,
    secretAccessKey: opts.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  const hostname = new URL(opts.endpoint).hostname
  const bucketUrl = (key: string) => `https://${hostname}/${opts.bucket}/${key}`
  return { client, hostname, bucketUrl }
}

export function r2Key(hash: string, title?: string): string {
  if (title) return `${UPLOAD_PREFIX}${hash}_${title}.zip`
  return `${UPLOAD_PREFIX}${hash}.zip`
}

export function hashFromKey(key: string): string {
  const base = key.replace(UPLOAD_PREFIX, '').replace(/\.zip$/, '')
  const idx = base.indexOf('_')
  return idx === -1 ? base : base.substring(0, idx)
}

export function keyInfo(key: string): { hash: string; title: string } {
  const base = key.replace(UPLOAD_PREFIX, '').replace(/\.zip$/, '')
  const idx = base.indexOf('_')
  const hash = idx === -1 ? base : base.substring(0, idx)
  const title = idx === -1 ? '' : base.substring(idx + 1)
  return { hash, title }
}

export async function listObjects(
  client: AwsClient, hostname: string, bucket: string, prefix: string,
): Promise<string[]> {
  const url = `https://${hostname}/${bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}`
  const res = await client.fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`R2 list failed: ${res.status}`)
  const xml = await res.text()
  const keys: string[] = []
  const re = /<Key>([^<]+)<\/Key>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    if (m[1].endsWith('.zip')) keys.push(m[1])
  }
  return keys
}

export async function downloadObject(
  client: AwsClient, hostname: string, bucket: string, key: string,
): Promise<ArrayBuffer> {
  const url = `https://${hostname}/${bucket}/${key}`
  const res = await client.fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`R2 download failed [${key}]: ${res.status}`)
  return res.arrayBuffer()
}

export async function deleteObject(
  client: AwsClient, hostname: string, bucket: string, key: string,
): Promise<void> {
  const url = `https://${hostname}/${bucket}/${key}`
  const res = await client.fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) console.warn(`  ⚠ delete R2 ${key}: ${res.status}`)
}
