import { json, err } from '../lib/response'
import { getPageContent, getReleaseAsset, downloadReleaseAsset, checkReleaseExists, listReleaseTags } from '../lib/github'
import { HASH_REGEX } from '../../shared/constants'
import type { Router } from '../lib/router'
import type { Env } from '../lib/types'

interface BookEntry { h: string; t: string; a: string; c: number; p: number; d: string; tag: string }

let indexCache: { books: BookEntry[]; ts: number } | null = null
const INDEX_TTL = 60_000
const ASSET_TTL = 86400

async function getIndex(env: Env): Promise<BookEntry[]> {
  if (indexCache && Date.now() - indexCache.ts < INDEX_TTL) return indexCache.books
  const { CONTENT_OWNER, CONTENT_REPO, GH_PAT } = env
  const raw = await getPageContent(CONTENT_OWNER, CONTENT_REPO, 'index.json', GH_PAT)
  const books = raw ? JSON.parse(raw).books || [] : []
  indexCache = { books, ts: Date.now() }
  return books
}

async function proxyAsset(
  env: Env, request: Request, ctx: ExecutionContext,
  tag: string, assetName: string,
): Promise<Response> {
  const { CONTENT_OWNER, CONTENT_REPO, GH_PAT } = env
  const cache = caches.default
  const cached = await cache.match(request)
  if (cached) return cached
  const asset = await getReleaseAsset(CONTENT_OWNER, CONTENT_REPO, tag, assetName, GH_PAT)
  if (!asset) return err('NOT_FOUND', null, 404)
  const res = await downloadReleaseAsset(CONTENT_OWNER, CONTENT_REPO, asset.id, GH_PAT)
  if (!res.ok) return err('NOT_FOUND', null, 404)
  const headers = new Headers(res.headers)
  headers.set('Cache-Control', `public, max-age=${ASSET_TTL}, immutable`)
  const response = new Response(res.body, { status: res.status, headers })
  ctx.waitUntil(cache.put(request, response.clone()))
  return response
}

export function register(router: Router) {
  router.get('/api/books', async (req, env) => {
    const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() || ''
    const books = await getIndex(env)
    const result = q ? books.filter(b =>
      b.t.toLowerCase().includes(q) || b.a.toLowerCase().includes(q)) : books
    return json({ books: result })
  }, {
    summary: '搜索/列出书籍',
    tags: ['Books'],
    query: { q: { description: '搜索关键词（可选）', required: false } },
    responses: { '200': { description: '{ books: BookEntry[] }', type: 'object' } }
  })

  router.get('/api/books/:hash', async (req, env, _ctx, params) => {
    const hash = params.hash
    if (!HASH_REGEX.test(hash)) return err('INVALID_REQUEST', null, 400)
    const books = await getIndex(env)
    const book = books.find(b => b.h === hash)
    if (!book) return err('NOT_FOUND', null, 404)
    return json(book)
  }, {
    summary: '获取书籍详情',
    tags: ['Books'],
    params: { hash: { description: '书籍 hash' } },
    responses: { '200': { description: 'BookEntry', type: 'object' } }
  })

  router.get('/api/books/:hash/toc', async (req, env, ctx, params) => {
    const hash = params.hash
    if (!HASH_REGEX.test(hash)) return err('INVALID_REQUEST', null, 400)
    const { CONTENT_OWNER, CONTENT_REPO, GH_PAT } = env
    const cache = caches.default
    const cached = await cache.match(req)
    if (cached) return cached
    const tag = `v${hash}0`
    const asset = await getReleaseAsset(CONTENT_OWNER, CONTENT_REPO, tag, 'toc.json', GH_PAT)
    if (!asset) return err('NOT_FOUND', null, 404)
    const res = await downloadReleaseAsset(CONTENT_OWNER, CONTENT_REPO, asset.id, GH_PAT)
    if (!res.ok) return err('NOT_FOUND', null, 404)
    const toc = await res.json()
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ASSET_TTL}`
    })
    const response = new Response(JSON.stringify(toc), { headers })
    ctx.waitUntil(cache.put(req, response.clone()))
    return response
  }, {
    summary: '获取书籍目录',
    tags: ['Books'],
    params: { hash: { description: '书籍 hash' } },
    responses: { '200': { description: 'TocEntry[]', type: 'array' } }
  })

  router.get('/api/books/:hash/cover', async (req, env, ctx, params) => {
    const hash = params.hash
    if (!HASH_REGEX.test(hash)) return err('INVALID_REQUEST', null, 400)
    return proxyAsset(env, req, ctx, `v${hash}0`, 'cover.jpg')
  }, {
    summary: '获取书籍封面',
    tags: ['Books'],
    params: { hash: { description: '书籍 hash' } },
    responses: { '200': { description: 'image/jpeg' } }
  })

  router.get('/api/books/:hash/chapters/:key', async (req, env, ctx, params) => {
    const hash = params.hash
    const chKey = params.key
    if (!HASH_REGEX.test(hash)) return err('INVALID_REQUEST', null, 400)
    const chHashLen = 12
    const partStr = chKey.substring(0, chKey.length - chHashLen)
    const partIdx = partStr ? parseInt(partStr, 10) : 0
    const tag = `v${hash}${partIdx}`
    const { CONTENT_OWNER, CONTENT_REPO, GH_PAT } = env
    const cache = caches.default
    const cached = await cache.match(req)
    if (cached) return cached
    const asset = await getReleaseAsset(CONTENT_OWNER, CONTENT_REPO, tag, `${chKey}.txt`, GH_PAT)
    if (!asset) return err('NOT_FOUND', null, 404)
    const res = await downloadReleaseAsset(CONTENT_OWNER, CONTENT_REPO, asset.id, GH_PAT)
    if (!res.ok) return err('NOT_FOUND', null, 404)
    const text = await res.text()
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ASSET_TTL}, immutable`
    })
    const response = new Response(JSON.stringify({ content: text }), { headers })
    ctx.waitUntil(cache.put(req, response.clone()))
    return response
  }, {
    summary: '获取章节内容',
    tags: ['Books'],
    params: {
      hash: { description: '书籍 hash' },
      key: { description: '章节 key (如 0a1b2c3d4e5f)' }
    },
    responses: { '200': { description: '{ content: string }', type: 'object' } }
  })

  router.get('/api/novel/:hash', async (_req, env, _ctx, params) => {
    const hash = params.hash
    if (!HASH_REGEX.test(hash)) return err('INVALID_REQUEST', null, 400)
    const { CONTENT_OWNER, CONTENT_REPO, GH_PAT } = env
    if (!CONTENT_OWNER || !CONTENT_REPO || !GH_PAT) return err('GITHUB_ERROR', null, 500)
    const tag = `v${hash}0`
    const release = await checkReleaseExists(CONTENT_OWNER, CONTENT_REPO, tag, GH_PAT)
    if (!release) return json({ exists: false })
    const tags = await listReleaseTags(CONTENT_OWNER, CONTENT_REPO, hash, GH_PAT)
    return json({ exists: true, guri: `urn:novel:sha256:${hash}`, tags, releaseUrl: release.htmlUrl })
  }, {
    summary: '检查书籍是否已发布',
    tags: ['Books'],
    params: { hash: { description: '书籍 hash' } },
    responses: { '200': { description: '{ exists, guri?, tags?, releaseUrl? }', type: 'object' } }
  })
}
