export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function err(code: string, message: string | null, status = 400): Response {
  const msg = message || errMessages[code] || code
  return json({ error: true, code, message: msg }, status)
}

const errMessages: Record<string, string> = {
  UNAUTHORIZED: '无效或缺失的 API Key',
  ACTION_RUNNING: '系统繁忙，请稍后操作',
  NOT_FOUND: '资源不存在',
  INVALID_REQUEST: '请求参数无效',
  UPLOAD_TOO_LARGE: '文件大小超出限制',
  R2_ERROR: '存储操作失败',
  GITHUB_ERROR: 'GitHub 配置缺失',
  INTERNAL_ERROR: '服务器内部错误',
}
