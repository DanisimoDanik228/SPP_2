import app from './app.js'
import { initializeAdmin } from './services/authService.js'
import { logEvent } from './utils/logger.js'

const port = Number(process.env.PORT ?? 8080)

await initializeAdmin()

app.listen(port, () => {
  logEvent('info', 'server_started', { port, environment: process.env.NODE_ENV ?? 'development' })
})