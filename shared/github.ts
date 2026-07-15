import { Octokit } from '@octokit/rest'

/** 创建一个带 token 的 Octokit 实例 */
export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token })
}

/** 检查 Release 是否存在 */
export async function releaseExists(
  octo: Octokit, owner: string, repo: string, tag: string,
): Promise<boolean> {
  try {
    await octo.rest.repos.getReleaseByTag({ owner, repo, tag })
    return true
  } catch (e: any) {
    if (e.status === 404) return false
    throw e
  }
}

export interface ReleaseInfo {
  tagName: string
  name: string
  htmlUrl: string
}

/** 查询 Release 详情 */
export async function getReleaseInfo(
  octo: Octokit, owner: string, repo: string, tag: string,
): Promise<ReleaseInfo | null> {
  try {
    const { data } = await octo.rest.repos.getReleaseByTag({ owner, repo, tag })
    return { tagName: data.tag_name, name: data.name || '', htmlUrl: data.html_url }
  } catch (e: any) {
    if (e.status === 404) return null
    return null
  }
}

/** 创建 Release */
export async function createRelease(
  octo: Octokit, owner: string, repo: string,
  tag: string, name: string, body: string,
) {
  const { data } = await octo.rest.repos.createRelease({
    owner, repo, tag_name: tag, name, body,
    draft: false, prerelease: false,
  })
  return data
}

/** 删除 Release 及其 tag */
export async function deleteReleaseByTag(
  octo: Octokit, owner: string, repo: string, tag: string,
): Promise<boolean> {
  try {
    const { data } = await octo.rest.repos.getReleaseByTag({ owner, repo, tag })
    await octo.rest.repos.deleteRelease({ owner, repo, release_id: data.id })
    await octo.rest.git.deleteRef({ owner, repo, ref: `tags/${tag}` })
    return true
  } catch (e: any) {
    if (e.status !== 404) console.warn(`  ⚠ deleteRelease ${tag}: ${e.message}`)
    return false
  }
}

/** 读取仓库文件 */
export async function readFile(
  octo: Octokit, owner: string, repo: string, path: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const { data } = await octo.rest.repos.getContent({ owner, repo, path })
    const b64 = (data as any).content
    const bytes = new Uint8Array([...atob(b64)].map(c => c.charCodeAt(0)))
    const content = new TextDecoder().decode(bytes)
    return { content, sha: (data as any).sha }
  } catch { return null }
}

/** 写入/更新仓库文件 */
export async function writeFile(
  octo: Octokit, owner: string, repo: string,
  path: string, content: string, message: string, sha?: string,
): Promise<void> {
  const bytes = new TextEncoder().encode(content)
  const b64 = btoa(String.fromCharCode(...bytes))
  const params: any = { owner, repo, path, message, content: b64 }
  if (sha) params.sha = sha
  await octo.rest.repos.createOrUpdateFileContents(params)
}

/** 列出指定 hash 的所有 Release tag */
export async function listReleaseTags(
  octo: Octokit, owner: string, repo: string, hash: string,
): Promise<string[]> {
  const prefix = `v${hash}`
  const tags: string[] = []
  try {
    const releases = await octo.paginate(octo.rest.repos.listReleases, { owner, repo, per_page: 100 })
    for (const r of releases) {
      if (r.tag_name.startsWith(prefix)) tags.push(r.tag_name)
    }
  } catch { /* */ }
  return tags.sort()
}

/** 获取 Release Asset 信息 */
export async function getReleaseAsset(
  octo: Octokit, owner: string, repo: string, tag: string, assetName: string,
): Promise<{ id: number; contentType: string } | null> {
  try {
    const { data } = await octo.rest.repos.getReleaseByTag({ owner, repo, tag })
    for (const a of data.assets) {
      if (a.name === assetName) return { id: a.id, contentType: a.content_type }
    }
  } catch { /* */ }
  return null
}

/** 上传 Release Asset */
export async function uploadAsset(
  octo: Octokit, uploadUrl: string,
  name: string,   data: Uint8Array, contentType: string,
): Promise<void> {
  const url = uploadUrl.replace('{?name,label}', `?name=${encodeURIComponent(name)}`)
  await octo.request({ method: 'POST', url, headers: { 'content-type': contentType }, data })
}

/** 下载 Release Asset */
export async function downloadAsset(
  owner: string, repo: string, assetId: number, token: string,
): Promise<Response> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/octet-stream',
      'User-Agent': 'novel',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

/** 并发上传多个 Asset */
export async function uploadAssets(
  octo: Octokit, uploadUrl: string,
  assets: { name: string; data: Uint8Array; type: string }[],
  concurrency = 8,
): Promise<void> {
  for (let i = 0; i < assets.length; i += concurrency) {
    await Promise.all(assets.slice(i, i + concurrency).map(a =>
      uploadAsset(octo, uploadUrl, a.name, a.data, a.type).catch(e => {
        console.warn(`  ⚠ ${a.name}: ${e.message}`)
      })
    ))
  }
}
