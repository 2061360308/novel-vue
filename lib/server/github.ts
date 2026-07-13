import { Octokit } from '@octokit/rest'

function client(token: string) {
  return new Octokit({ auth: token, request: { fetch } })
}

const WORKFLOW_YML = `\
name: Process Novel Uploads

on:
  workflow_dispatch:
    inputs:
      hash:
        description: 'Specify book hash (leave empty to process all pending)'
        required: false
        type: string

concurrency:
  group: process-novels
  cancel-in-progress: false

jobs:
  process:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          repository: __CODE_REPO__
          path: code
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
        working-directory: code
      - name: Process Uploads
        run: node code/scripts/process-uploads.mjs
        env:
          R2_ENDPOINT: \${{ secrets.R2_ENDPOINT }}
          R2_ACCESS_KEY_ID: \${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: \${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET_NAME: \${{ secrets.R2_BUCKET_NAME }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          INPUT_HASH: \${{ inputs.hash }}
`

async function ensureWorkflow(
  octo: Octokit,
  codeOwner: string, codeRepo: string,
  contentOwner: string, contentRepo: string,
) {
  const yml = WORKFLOW_YML.replace('__CODE_REPO__', `${codeOwner}/${codeRepo}`)
  const content = btoa(yml)
  let sha: string | undefined
  try {
    const { data } = await octo.rest.repos.getContent({
      owner: contentOwner, repo: contentRepo, path: '.github/workflows/main.yml',
    })
    sha = (data as any).sha
  } catch (e: any) {
    if (e.status !== 404) {
      console.error('ensureWorkflow getContent error:', e.status, e.message)
      return
    }
  }
  try {
    console.log('📝 自动' + (sha ? '更新' : '创建') + ' workflow 到内容仓库...')
    await octo.rest.repos.createOrUpdateFileContents({
      owner: contentOwner, repo: contentRepo,
      path: '.github/workflows/main.yml',
      message: '📝 初始化 novel 处理 workflow',
      content,
      ...(sha ? { sha } : {}),
    })
    console.log('✅ workflow ' + (sha ? '更新' : '创建') + '成功')
  } catch (e: any) {
    console.error('ensureWorkflow failed:', e.status, e.message)
  }
}

/* ── 代码仓库 (触发 Action) ────────────────── */

export async function isActionRunning(env: {
  CONTENT_OWNER: string; CONTENT_REPO: string; GITHUB_TOKEN: string
}): Promise<boolean> {
  const octo = client(env.GITHUB_TOKEN)
  try {
    const { data } = await octo.rest.actions.listWorkflowRuns({
      owner: env.CONTENT_OWNER,
      repo: env.CONTENT_REPO,
      workflow_id: 'main.yml',
      status: 'in_progress',
      per_page: 1,
    })
    return data.total_count > 0
  } catch {
    return false
  }
}

export async function triggerWorkflow(
  owner: string, repo: string, hash: string, token: string,
  codeOwner: string, codeRepo: string,
): Promise<boolean> {
  const octo = client(token)
  try {
    const inputs: Record<string, string> = {}
    if (hash) inputs.hash = hash
    await octo.rest.actions.createWorkflowDispatch({
      owner, repo,
      workflow_id: 'main.yml',
      ref: 'main',
      inputs,
    })
    return true
  } catch (e: any) {
    if (e.status === 404 || e.status === 422) {
      await ensureWorkflow(octo, codeOwner, codeRepo, owner, repo)
      try {
        const inputs: Record<string, string> = {}
        if (hash) inputs.hash = hash
        await octo.rest.actions.createWorkflowDispatch({
          owner, repo,
          workflow_id: 'main.yml',
          ref: 'main',
          inputs,
        })
        return true
      } catch (e2: any) {
        console.error('triggerWorkflow retry failed:', e2.status, e2.message)
      }
    } else {
      console.error('triggerWorkflow failed:', e.status, e.message)
    }
    return false
  }
}

/* ── 内容仓库 (Release & 索引) ──────────────── */

export interface ReleaseInfo {
  tagName: string
  name: string
  htmlUrl: string
}

export async function checkReleaseExists(
  owner: string, repo: string, tag: string, token: string,
): Promise<ReleaseInfo | null> {
  const octo = client(token)
  try {
    const { data } = await octo.rest.repos.getReleaseByTag({ owner, repo, tag })
    return { tagName: data.tag_name, name: data.name || '', htmlUrl: data.html_url }
  } catch (e: any) {
    if (e.status === 404) return null
    return null
  }
}

export async function getReleaseAsset(
  owner: string, repo: string, tag: string, assetName: string, token: string,
): Promise<{ id: number; contentType: string } | null> {
  const octo = client(token)
  try {
    const { data } = await octo.rest.repos.getReleaseByTag({ owner, repo, tag })
    for (const a of data.assets) {
      if (a.name === assetName) {
        return { id: a.id, contentType: a.content_type }
      }
    }
    console.log(`asset "${assetName}" not found in [${data.assets.map(a => a.name).join(', ')}]`)
  } catch (e: any) {
    console.log(`release "${tag}" error:`, e.status, e.message)
  }
  return null
}

export async function downloadReleaseAsset(
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

export async function getPageContent(
  owner: string, repo: string, path: string, token: string,
): Promise<string | null> {
  const octo = client(token)
  try {
    const { data } = await octo.rest.repos.getContent({ owner, repo, path })
    const b64 = (data as any).content
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch { /* */ }
  return null
}
export async function listReleaseTags(
  owner: string, repo: string, hash: string, token: string,
): Promise<string[]> {
  const octo = client(token)
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
