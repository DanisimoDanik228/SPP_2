import crypto from 'node:crypto'

export function logEvent(level, event, fields = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  }
  const output = JSON.stringify(record)
  if (level === 'error') {
    console.error(output)
  } else {
    console.log(output)
  }
}

export function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID()
  const startedAt = process.hrtime.bigint()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    logEvent(res.statusCode >= 500 ? 'error' : 'info', 'http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    })
  })

  next()
}
