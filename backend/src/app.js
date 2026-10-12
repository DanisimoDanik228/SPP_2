import express from 'express'
import cors from 'cors'
import multer from 'multer'
import swaggerUi from 'swagger-ui-express'
import { uploadsDir } from './db.js'
import authRouter from './routes/auth.js'
import productsRouter from './routes/products.js'
import { swaggerDocument } from './swagger.js'
import { ImageValidationError } from './middlewares/upload.js'
import { requestLogger, logEvent } from './utils/logger.js'

const app = express()

app.use(requestLogger)

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://frontend',
  ],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Request-Id', 'Retry-After'],
}))

app.use(express.json({ limit: '32kb' }))

app.use('/uploads', express.static(uploadsDir))

app.use('/api/auth', authRouter)
app.use('/api/products', productsRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.path} was not found.`,
    requestId: req.requestId,
  })
})

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }

  if (error instanceof ImageValidationError) {
    res.status(415).json({
      message: 'Unsupported media type.',
      errors: { image: [error.message] },
      requestId: req.requestId,
    })
    return
  }

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'
    res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? 'Payload too large.' : 'Invalid multipart request.',
      errors: { image: [tooLarge ? 'Image must be smaller than 5 MB.' : error.message] },
      requestId: req.requestId,
    })
    return
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500
  const headers = error.headers && typeof error.headers === 'object' ? error.headers : {}
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value)
  }

  if (status >= 500) {
    logEvent('error', 'http_error', {
      requestId: req.requestId,
      status,
      error: error.name ?? 'Error',
      message: error.message,
    })
  }

  const message = status >= 500
    ? 'Internal server error.'
    : (error.message || 'Request failed.')
  const body = { message, requestId: req.requestId }
  if (error.errors) {
    body.errors = error.errors
  }
  res.status(status).json(body)
})

export default app