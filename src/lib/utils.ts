import { SHORT_HASH_LEN } from './constants'

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text).buffer
  return sha256Buffer(data)
}

export async function sha256Buffer(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function computeContentHash(title: string, author: string, chapters: { title: string; body: string }[]): Promise<string> {
  let content = `${title}\n${author}\n`
  for (const ch of chapters) content += `${ch.title}\n${ch.body}\n`
  return (await sha256(content)).substring(0, SHORT_HASH_LEN)
}

export async function computeChapterHash(body: string): Promise<string> {
  return sha256(body)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleString('zh-CN')
}

export function htmlToText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  let text = ''
  for (const node of div.childNodes) text += nodeToText(node)
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function nodeToText(node: ChildNode): string {
  if (node.nodeType === 3) return node.textContent || ''
  if (node.nodeType === 1) {
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') return '\n'
    if (/^(p|div|h[1-6]|li|tr)$/.test(tag)) {
      let t = ''
      for (const c of el.childNodes) t += nodeToText(c)
      return '\n' + t.trim() + '\n'
    }
    let t = ''
    for (const c of el.childNodes) t += nodeToText(c)
    return t
  }
  return ''
}

export function escapeHtml(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}
