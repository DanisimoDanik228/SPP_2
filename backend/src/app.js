import express from 'express'
import cors from 'cors'
import multer from 'multer'
import swaggerUi from 'swagger-ui-express'
import { uploadsDir } from './db.js'
import productsRouter from './routes/products.js'
import { swaggerDocument } from './swagger.js'
import { ImageValidationError } from './middlewares/upload.js'

const app = express()

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://frontend',
  ],
}))

app.use(express.json())

app.use('/uploads', express.static(uploadsDir))

app.use('/api/products', productsRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} was not found.` })
})

app.use((error, req, res, _next) => {
  if (error instanceof ImageValidationError) {
    res.status(400).json({
      message: 'Validation failed',
      errors: { image: [error.message] },
    })
    return
  }

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      message: 'Validation failed',
      errors: { image: ['Image must be smaller than 5 MB.'] },
    })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'Internal server error.' })
})

export default app