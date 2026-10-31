import cors from 'cors'
import express from 'express'
import { config } from './config'
import { errorHandler, notFound } from './middleware/errorHandler'
import { api } from './routes'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // อยู่หลัง Proxy ของ Render

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=()')
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      )
    }
    next()
  })

  app.use(
    cors({
      origin(origin, cb) {
        // ไม่มี Origin = เรียกจาก curl/เซิร์ฟเวอร์ หรือผ่าน Vite proxy (same-origin)
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true)
        return cb(null, false)
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Client-Id', 'Authorization'],
    }),
  )
  app.use(express.json({ limit: '50kb' }))

  app.use('/api', api)
  app.use(notFound)
  app.use(errorHandler)
  return app
}
