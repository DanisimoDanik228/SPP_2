import { AuthError, authenticate } from '../services/authService.js'

export function requireAuth(req, _res, next) {
  const authorization = req.get('authorization') ?? ''
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization)
  if (!match) {
    next(new AuthError(401, 'A valid bearer token is required.', {
      'WWW-Authenticate': 'Bearer',
    }))
    return
  }

  const user = authenticate(match[1])
  if (!user) {
    next(new AuthError(401, 'The access token is invalid or has expired.', {
      'WWW-Authenticate': 'Bearer error="invalid_token"',
    }))
    return
  }
  req.user = user
  req.authToken = match[1]
  next()
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AuthError(403, 'You do not have permission to perform this action.'))
      return
    }
    next()
  }
}
