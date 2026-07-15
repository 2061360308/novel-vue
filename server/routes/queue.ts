import { json, err } from '../lib/response'
import { isActionRunning } from '../lib/action'
import { fileExists, listFiles, deleteFile } from '../lib/r2'
import { UPLOAD_PREFIX } from '../../shared/constants'
import type { Router } from '../lib/router'

const QueueFileSchema = {
  type: 'object' as const,
  properties: {
    key: { type: 'string', description: '文件路径', example: 'uploads/a1b2c3d4e5f6_三体.zip' },
    size: { type: 'integer', description: '文件大小 (bytes)' },
    uploaded: { type: 'string', format: 'date-time', description: '上传时间' },
  },
}

export function register(router: Router) {
  router.get('/api/queue', async (req, env) => {
    let running = false
    try { running = await isActionRunning(env) } catch { /* */ }
    let files: { key: string; size: number; uploaded: string }[] = []
    try { files = await listFiles(env) } catch (e) { console.error(e) }

    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const cursor = url.searchParams.get('cursor') || undefined

    let result = files
    if (cursor) {
      const idx = files.findIndex(f => f.key === cursor)
      if (idx >= 0) result = files.slice(idx + 1)
    }
    result = result.slice(0, limit)
    const nextCursor = result.length === limit && files.indexOf(result[result.length - 1]!) < files.length - 1
      ? result[result.length - 1]!.key : undefined

    return json({ files: result, total: files.length, nextCursor })
  }, {
    summary: '列出待处理文件',
    description: '返回 R2 上传队列中的文件列表，支持分页。',
    tags: ['Queue'],
    query: {
      limit: { type: 'integer', description: '每页数量（默认 50）', required: false, example: 20 },
      cursor: { type: 'string', description: '上一页最后一条的 key', required: false },
    },
    responses: {
      '200': {
        description: '文件列表及 Action 运行状态',
        content: { schema: { type: 'object', properties: { files: { type: 'array', items: QueueFileSchema }, total: { type: 'integer' }, nextCursor: { type: 'string' }, actionRunning: { type: 'boolean' } } } },
      },
    },
  })

  router.delete('/api/queue/:key', async (_req, env, _ctx, params) => {
    if (await isActionRunning(env)) return err('ACTION_RUNNING', null, 503)
    const key = decodeURIComponent(params.key)
    if (!key.startsWith(UPLOAD_PREFIX)) return err('INVALID_REQUEST', null, 400)
    try {
      if (!(await fileExists(key, env))) return err('NOT_FOUND', null, 404)
      await deleteFile(key, env)
    } catch { return err('R2_ERROR', null, 500) }
    return json({ deleted: true, key })
  }, {
    summary: '删除待处理文件',
    tags: ['Queue'],
    params: { key: { description: '文件路径', example: 'uploads/a1b2c3d4e5f6_三体.zip' } },
    responses: {
      '200': { description: '删除成功', content: { schema: { type: 'object', properties: { deleted: { type: 'boolean' }, key: { type: 'string' } } } } },
      '404': { description: '[NOT_FOUND] 文件不存在', content: { schema: { type: 'object' } } },
      '503': { description: '[ACTION_RUNNING] 已有 Action 运行中' },
    },
  })
}
