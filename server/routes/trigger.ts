import { json, err } from '../lib/response'
import { isActionRunning } from '../lib/action'
import { triggerWorkflow } from '../lib/github'
import type { Router } from '../lib/router'

export function register(router: Router) {
  router.post('/api/trigger', async (_req, env) => {
    if (await isActionRunning(env)) return err('ACTION_RUNNING', null, 503)
    const { CONTENT_OWNER, CONTENT_REPO, GH_PAT, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env
    if (!CONTENT_OWNER || !CONTENT_REPO || !GH_PAT) return err('GITHUB_ERROR', null, 500)
    const ok = await triggerWorkflow(CONTENT_OWNER, CONTENT_REPO, GH_PAT, { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME })
    return json({ triggered: ok })
  }, {
    summary: '触发处理工作流',
    tags: ['Action'],
    responses: { '200': { description: '{ triggered: boolean }' } }
  })
}
