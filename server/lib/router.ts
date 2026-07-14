import { err } from './response'
import { validateRequest } from './auth'
import type { Env } from './types'

export interface ParamSchema {
  type?: string
  description?: string
  required?: boolean
}

export interface RouteMeta {
  summary?: string
  description?: string
  tags?: string[]
  auth?: boolean
  params?: Record<string, ParamSchema>
  query?: Record<string, { type?: string; description?: string; required?: boolean }>
  requestBody?: { type: string; description?: string }
  responses?: Record<string, { description: string; type?: string }>
}

export type Handler = (
  req: Request, env: Env, ctx: ExecutionContext,
  params: Record<string, string>,
) => Response | Promise<Response>

interface Route {
  methods: string[]
  pattern: URLPattern
  handler: Handler
  meta: RouteMeta
}

export class Router {
  private routes: Route[] = []
  private title: string
  private version: string

  constructor(info: { title: string; version: string }) {
    this.title = info.title
    this.version = info.version
  }

  private add(methods: string[], path: string, handler: Handler, meta: RouteMeta = {}) {
    const pattern = new URLPattern({ pathname: path })
    this.routes.push({ methods, pattern, handler, meta: { auth: true, ...meta } })
  }

  get(path: string, handler: Handler, meta?: RouteMeta) {
    this.add(['GET'], path, handler, meta)
  }
  post(path: string, handler: Handler, meta?: RouteMeta) {
    this.add(['POST'], path, handler, meta)
  }
  delete(path: string, handler: Handler, meta?: RouteMeta) {
    this.add(['DELETE'], path, handler, meta)
  }

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
    const url = new URL(req.url)
    for (const route of this.routes) {
      if (!route.methods.includes(req.method)) continue
      const match = route.pattern.exec(url)
      if (!match) continue

      try {
        const params = Object.fromEntries(
          Object.entries(match.pathname.groups).map(([k, v]) => [k, v ?? ''])
        )
        if (route.meta.auth !== false) {
          if (!validateRequest(req, env)) return err('UNAUTHORIZED', null, 401)
        }
        return await route.handler(req, env, ctx, params)
      } catch (e) {
        console.error(e)
        return err('INTERNAL_ERROR', null, 500)
      }
    }
    return null
  }

  toOpenAPIDoc() {
    const paths: Record<string, any> = {}
    const tags = new Set<string>()

    for (const { methods, pattern, meta } of this.routes) {
      const pathKey = pattern.pathname
        .replace(/:(\w+)/g, '{$1}')
      if (!paths[pathKey]) paths[pathKey] = {}

      const operation: any = {
        summary: meta.summary || '',
        description: meta.description || '',
        tags: meta.tags || ['default'],
        responses: meta.responses || {}
      }

      if (!operation.responses['400']) {
        operation.responses['400'] = { description: '参数错误' }
      }
      if (meta.auth !== false && !operation.responses['401']) {
        operation.responses['401'] = { description: '未授权' }
      }
      if (!operation.responses['500']) {
        operation.responses['500'] = { description: '服务器错误' }
      }

      if (meta.params) {
        operation.parameters = operation.parameters || []
        for (const [name, schema] of Object.entries(meta.params)) {
          operation.parameters.push({
            name, in: 'path', required: schema.required ?? true,
            schema: { type: schema.type || 'string' },
            description: schema.description || '',
          })
        }
      }

      if (meta.query) {
        operation.parameters = operation.parameters || []
        for (const [name, schema] of Object.entries(meta.query)) {
          operation.parameters.push({
            name, in: 'query', required: schema.required ?? false,
            schema: { type: schema.type || 'string' },
            description: schema.description || '',
          })
        }
      }

      if (meta.requestBody) {
        operation.requestBody = {
          content: { 'application/json': { schema: { type: meta.requestBody.type } } },
          description: meta.requestBody.description || '',
        }
      }

      for (const tag of (meta.tags || ['default'])) tags.add(tag)

      for (const method of methods) {
        paths[pathKey][method.toLowerCase()] = operation
      }
    }

    return {
      openapi: '3.0.3',
      info: { title: this.title, version: this.version },
      paths,
      tags: [...tags].map(name => ({ name })),
    }
  }
}
