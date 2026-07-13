import JSZip from 'jszip'
import { computeContentHash, computeChapterHash, htmlToText } from './utils'
import { DEFAULT_TXT_REGEX } from './constants'

export interface NovelData {
  title: string
  author: string
  description: string
  cover: string | null
  chapters: ChapterData[]
  contentHash: string
  sourceFormat: string
  fileName: string
}

export interface ChapterData {
  title: string
  body: string
  hash: string
  level: number
}

export async function parseFile(file: File, opts?: { regex?: string }): Promise<NovelData> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'epub') return parseEpub(file)
  if (ext === 'txt') return parseTxt(file, opts?.regex)
  throw new Error(`不支持的文件格式: .${ext}`)
}

async function parseEpub(file: File): Promise<NovelData> {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  const opfPath = await findOpf(zip)
  const xml = await zip.file(opfPath)!.async('string')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const dir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1)

  const title = opfText(doc, 'title') || '未知书名'
  const author = opfText(doc, 'creator') || '未知作者'
  const desc = opfText(doc, 'description') || ''
  const manifest = parseManifest(doc, dir)
  const spineIds = parseSpine(doc)
  const coverId = findCoverId(doc)
  const cover = coverId ? await extractCover(zip, manifest, coverId) : null

  const chapters: ChapterData[] = []
  for (const id of spineIds) {
    const item = manifest.get(id)
    if (!item) continue
    try {
      const html = await zip.file(item.path)!.async('string')
      const body = htmlToText(html)
      if (!body.trim()) continue
      const chTitle = extractChapterTitle(html, body)
      const chHash = await computeChapterHash(body)
      chapters.push({ title: chTitle, body, hash: chHash, level: 1 })
    } catch { /* skip */ }
  }
  if (!chapters.length) throw new Error('未解析到章节')
  const hash = await computeContentHash(title, author, chapters)
  return { title, author, description: desc, cover, chapters, contentHash: hash, sourceFormat: 'epub', fileName: file.name }
}

async function parseTxt(file: File, customRegex?: string): Promise<NovelData> {
  const text = await file.text()
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let title = '未知书名', author = '未知作者'

  const first = lines.find(l => l.trim())
  if (first && first.trim().length < 60 && !/^第[零一二三四五六七八九十百千万\d]+[章节]/.test(first.trim())) {
    title = first.trim().replace(/^[《「『\s]+|[》」』\s]+$/g, '')
  }

  let re = DEFAULT_TXT_REGEX
  if (customRegex) {
    try { re = new RegExp(customRegex) } catch { /* keep default */ }
  }

  const raw: { title: string; lines: string[] }[] = []
  let curTitle = '前言', curLines: string[] = []
  for (const line of lines) {
    const m = line.match(re)
    if (m) {
      if (curLines.length || !raw.length) raw.push({ title: curTitle, lines: curLines })
      curTitle = (m[1] || m[0]).trim()
      curLines = []
    } else { curLines.push(line) }
  }
  if (curLines.length) raw.push({ title: curTitle, lines: curLines })

  const chapters: ChapterData[] = []
  for (const r of raw) {
    let body = r.lines.join('\n').trim().replace(/\n{3,}/g, '\n\n')
    if (!body && r.title === '前言') continue
    const chHash = await computeChapterHash(body)
    chapters.push({ title: r.title, body, hash: chHash, level: 1 })
  }
  if (!chapters.length) throw new Error('未解析到章节')
  const hash = await computeContentHash(title, author, chapters)
  return { title, author, description: '', cover: null, chapters, contentHash: hash, sourceFormat: 'txt', fileName: file.name }
}

async function findOpf(zip: JSZip): Promise<string> {
  const xml = await zip.file('META-INF/container.xml')!.async('string')
  const el = new DOMParser().parseFromString(xml, 'application/xml').querySelector('rootfile')
  if (!el) throw new Error('无效 EPUB')
  return el.getAttribute('full-path')!
}

function opfText(doc: Document, tag: string): string | null {
  const el = doc.querySelector(`metadata > *|${tag}, metadata > ${tag}`)
  return el ? el.textContent!.trim() : null
}

function parseManifest(doc: Document, dir: string): Map<string, { path: string; mediaType: string | null }> {
  const m = new Map()
  for (const el of doc.querySelectorAll('manifest > item')) {
    const id = el.getAttribute('id'), href = el.getAttribute('href')
    if (id && href) {
      let path = href.replace(/^\/+/, '')
      if (!path.includes('://')) path = dir + path
      m.set(id, { path: path.replace(/\/+/g, '/'), mediaType: el.getAttribute('media-type') })
    }
  }
  return m
}

function parseSpine(doc: Document): string[] {
  return [...doc.querySelectorAll('spine > itemref')].map(el => el.getAttribute('idref')).filter(Boolean) as string[]
}

function findCoverId(doc: Document): string | null {
  const meta = doc.querySelector('meta[name="cover"]')
  if (meta) return meta.getAttribute('content')
  const guide = doc.querySelector('guide > reference[type="cover"]')
  if (guide) return guide.getAttribute('href')
  return null
}

async function extractCover(zip: JSZip, manifest: Map<string, { path: string; mediaType: string | null }>, coverId: string): Promise<string | null> {
  const item = manifest.get(coverId)
  if (!item) return null
  try {
    const b64 = await zip.file(item.path)!.async('base64')
    return `data:${item.mediaType || 'image/jpeg'};base64,${b64}`
  } catch { return null }
}

function extractChapterTitle(html: string, body: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const h = doc.querySelector('h1, h2, h3, title')
  if (h) return h.textContent!.trim()
  const line = body.split('\n')[0].trim()
  return line.length < 80 ? line : '未命名章节'
}
