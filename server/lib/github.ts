import * as GH from '../../shared/github'
import type { R2Input } from './types'

// 包装函数：自动创建 Octokit，兼容旧调用签名

export async function checkReleaseExists(
  owner: string, repo: string, tag: string, token: string,
): Promise<GH.ReleaseInfo | null> {
  const octo = GH.createOctokit(token)
  return GH.getReleaseInfo(octo, owner, repo, tag)
}

export async function getReleaseAsset(
  owner: string, repo: string, tag: string, assetName: string, token: string,
): Promise<{ id: number; contentType: string } | null> {
  const octo = GH.createOctokit(token)
  return GH.getReleaseAsset(octo, owner, repo, tag, assetName)
}

export async function downloadReleaseAsset(
  owner: string, repo: string, assetId: number, token: string,
): Promise<Response> {
  return GH.downloadAsset(owner, repo, assetId, token)
}

export async function getPageContent(
  owner: string, repo: string, path: string, token: string,
): Promise<string | null> {
  const octo = GH.createOctokit(token)
  const result = await GH.readFile(octo, owner, repo, path)
  return result?.content ?? null
}

export async function listReleaseTags(
  owner: string, repo: string, hash: string, token: string,
): Promise<string[]> {
  const octo = GH.createOctokit(token)
  return GH.listReleaseTags(octo, owner, repo, hash)
}

export type ReleaseInfo = GH.ReleaseInfo

/* ── 触发 Action ───────────────────────────── */

export async function isActionRunning(env: {
  CONTENT_OWNER: string; CONTENT_REPO: string; GH_PAT: string
}): Promise<boolean> {
  const octo = GH.createOctokit(env.GH_PAT)
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
  owner: string, repo: string, token: string, r2: R2Input,
): Promise<boolean> {
  const octo = GH.createOctokit(token)
  try {
    await octo.rest.actions.createWorkflowDispatch({
      owner, repo,
      workflow_id: 'main.yml',
      ref: 'main',
      inputs: {
        r2_endpoint: r2.R2_ENDPOINT,
        r2_access_key_id: r2.R2_ACCESS_KEY_ID,
        r2_secret_access_key: r2.R2_SECRET_ACCESS_KEY,
        r2_bucket_name: r2.R2_BUCKET_NAME,
      },
    })
    return true
  } catch (e: any) {
    console.error('triggerWorkflow failed:', e.status, e.message)
    return false
  }
}
