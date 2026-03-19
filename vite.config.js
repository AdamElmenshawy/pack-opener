import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PROXIES = [
  {
    prefix: '/api/images',
    targetBase: 'https://ocs-production-public-images.s3.amazonaws.com/images'
  },
  {
    prefix: '/api/verifai-images',
    targetBase: 'https://ocs-verifai-public-images.s3.amazonaws.com'
  }
]

function createProxyMiddleware(prefix, targetBase) {
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith(prefix)) return next()
    const targetUrl = `${targetBase}${req.url.slice(prefix.length)}`
    try {
      const method = (req.method || 'GET').toUpperCase()
      const headers = {
        ...(req.headers.accept ? { accept: req.headers.accept } : {}),
        ...(req.headers['user-agent'] ? { 'user-agent': req.headers['user-agent'] } : {})
      }
      const response = await fetch(targetUrl, { method, headers, redirect: 'follow' })
      console.debug(`[proxy] ${method} ${req.url} -> ${targetUrl} (${response.status})`)
      res.statusCode = response.status
      res.setHeader('Access-Control-Allow-Origin', '*')
      response.headers.forEach((value, key) => {
        if (['transfer-encoding', 'connection'].includes(key.toLowerCase())) return
        res.setHeader(key, value)
      })
      if (method === 'HEAD') return res.end()
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      next(error)
    }
  }
}

const imageProxyPlugin = {
  name: 'pack-opener-image-proxy',
  configureServer(server) {
    PROXIES.forEach(({ prefix, targetBase }) => {
      server.middlewares.use(createProxyMiddleware(prefix, targetBase))
    })
  },
  configurePreviewServer(server) {
    PROXIES.forEach(({ prefix, targetBase }) => {
      server.middlewares.use(createProxyMiddleware(prefix, targetBase))
    })
  }
}

export default defineConfig({
  plugins: [react(), imageProxyPlugin]
})
