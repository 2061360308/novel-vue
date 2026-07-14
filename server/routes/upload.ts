import { json, err } from '../lib/response'
import { isActionRunning } from '../lib/action'
import { createR2Client, createPresignedUrl } from '../lib/presign'
import { r2Key, fileExists } from '../lib/r2'
import { triggerWorkflow } from '../lib/github'
import { HASH_REGEX, PRESIGN_EXPIRES } from '../../shared/constants'
import type { Router } from '../lib/router'

export function register(router: Router) {
  router.post('/api/upload/presign', async (req, env) => {
    let body: { hash?: string; size?: number; title?: string }
    try { body = await req.json() } catch { return err('INVALID_REQUEST', null, 400) }
    const { hash, size, title } = body
    if (typeof hash !== 'string' || !HASH_REGEX.test(hash)) return err('INVALID_REQUEST', null, 400)
    const maxSize = parseInt(env.MAX_UPLOAD_SIZE, 10) || 52428800
    if (typeof size !== 'number' || size <= 0 || size > maxSize) return err('UPLOAD_TOO_LARGE', null, 400)
    if (await isActionRunning(env)) return err('ACTION_RUNNING', null, 503)

    const key = r2Key(hash, typeof title === 'string' ? title : undefined)
    const client = createR2Client(env)
    const { url } = await createPresignedUrl(client, env.R2_ENDPOINT, {
      bucket: env.R2_BUCKET_NAME,
      key,
      size,
      contentType: 'application/zip',
    })
    return json({ url, key, expiresIn: PRESIGN_EXPIRES })
  }, {
    summary: '获取预签名上传 URL',
    tags: ['Upload'],
    requestBody: { type: 'object', description: '{ hash, size, title? }' },
    responses: { '200': { description: '{ url, key, expiresIn }' } }
  })

  router.post('/api/upload/complete', async (req, env) => {
    let body: { hash?: string; title?: string }
    try { body = await req.json() } catch { return err('INVALID_REQUEST', null, 400) }
    const { hash, title } = body
    if (typeof hash !== 'string' || !HASH_REGEX.test(hash)) return err('INVALID_REQUEST', null, 400)
    const key = r2Key(hash, typeof title === 'string' ? title : undefined)
    if (!(await fileExists(key, env))) return err('NOT_FOUND', null, 404)
    if (await isActionRunning(env)) {
      return json({ status: 'queued', hash, message: '文件已接收，将在下一轮被处理' })
    }
    const { CONTENT_OWNER, CONTENT_REPO, GH_PAT, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env
    let triggered = false
    if (CONTENT_OWNER && CONTENT_REPO && GH_PAT) {
      triggered = await triggerWorkflow(CONTENT_OWNER, CONTENT_REPO, GH_PAT, { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME })
    }
    return json({ status: triggered ? 'processing' : 'queued', hash, message: triggered ? '处理已开始' : '文件已接收，等待下一轮 Cron 处理' })
  }, {
    summary: '确认上传完成并触发处理',
    tags: ['Upload'],
    requestBody: { type: 'object', description: '{ hash, title? }' },
    responses: { '200': { description: '{ status, hash, message }' } }
  })
}
