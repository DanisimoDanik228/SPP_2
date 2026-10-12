const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    price: { type: 'number', format: 'double' },
    category: { type: 'string' },
    imageUrl: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
}

const validationErrorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string', example: 'Validation failed' },
    errors: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
}

const multipartPayload = {
  required: ['name', 'price', 'category'],
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '2–100 characters' },
          description: { type: 'string', description: 'optional, max 500 characters' },
          price: { type: 'number', format: 'double', description: 'greater than 0' },
          category: { type: 'string', description: '2–50 characters' },
          image: {
            type: 'string',
            format: 'binary',
            description: 'JPG, JPEG, PNG, GIF or WEBP, max 5 MB',
          },
        },
      },
    },
  },
}

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'ProductHub API',
    version: '1.0.0',
    description: 'REST API for ProductHub with time-limited bearer access keys and role-based catalog access.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/products': {
      get: {
        summary: 'List products',
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Search by name, description or category',
          },
        ],
        responses: {
          200: {
            description: 'Product list',
            content: {
              'application/json': {
                schema: { type: 'array', items: productSchema },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a product',
        security: [{ bearerAuth: [] }],
        requestBody: multipartPayload,
        responses: {
          201: {
            description: 'Product created',
            content: { 'application/json': { schema: productSchema } },
          },
          400: {
            description: 'Validation failed',
            content: { 'application/json': { schema: validationErrorSchema } },
          },
        },
      },
    },
    '/api/products/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      get: {
        summary: 'Get a product by id',
        responses: {
          200: {
            description: 'Product found',
            content: { 'application/json': { schema: productSchema } },
          },
          404: {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      put: {
        summary: 'Update a product (multipart, can replace the image)',
        security: [{ bearerAuth: [] }],
        requestBody: multipartPayload,
        responses: {
          200: {
            description: 'Product updated',
            content: { 'application/json': { schema: productSchema } },
          },
          400: {
            description: 'Validation failed',
            content: { 'application/json': { schema: validationErrorSchema } },
          },
          404: {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Delete a product',
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: 'Product deleted' },
          404: {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register a viewer account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 12, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created with a time-limited bearer key' },
          400: { description: 'Invalid email or password' },
          409: { description: 'Email is already registered' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in and issue a time-limited bearer key',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Bearer key and account' },
          401: { description: 'Invalid credentials' },
          409: { description: 'Active session limit reached' },
          429: { description: 'Login rate limit exceeded' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        summary: 'Revoke the current session',
        security: [{ bearerAuth: [] }],
        responses: {
          204: { description: 'Session revoked' },
          401: { description: 'Authentication required' },
        },
      },
      '/api/auth/me': {
        get: {
          summary: 'Get the current account and role',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Authenticated account' },
            401: { description: 'Authentication required' },
          },
        },
      },
      '/api/auth/sessions': {
        get: {
          summary: 'List current account sessions',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Unexpired sessions belonging to the current account, including the current-session flag' },
            401: { description: 'Authentication required' },
          },
        },
      },
      '/api/auth/sessions/{id}': {
        delete: {
          summary: 'Revoke one of the current account sessions',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
          ],
          responses: {
            204: { description: 'Session revoked' },
            400: { description: 'Invalid session id' },
            404: { description: 'Session not found' },
          },
        },
      },
      '/api/auth/users': {
        get: {
          summary: 'List user accounts (admin only)',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User accounts' },
            403: { description: 'Admin role required' },
          },
        },
      },
      '/api/auth/users/{id}/role': {
        patch: {
          summary: 'Change a user role (admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['role'],
                  properties: { role: { type: 'string', enum: ['admin', 'editor', 'viewer'] } },
                },
              },
            },
          },
          responses: {
            200: { description: 'Role changed' },
            400: { description: 'Invalid role or attempt to change own role' },
            403: { description: 'Admin role required' },
            404: { description: 'User not found' },
            409: { description: 'At least one administrator must remain' },
          },
        },
      },
    },
    '/api/auth/password/forgot': {
      post: {
        summary: 'Email a one-time password reset token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          202: { description: 'Generic response that does not reveal account existence' },
          429: { description: 'Recovery rate limit exceeded' },
          503: { description: 'Email delivery is unavailable' },
        },
      },
    },
    '/api/auth/password/reset': {
      post: {
        summary: 'Consume a password reset token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string' },
                  password: { type: 'string', minLength: 12, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          204: { description: 'Password reset and all sessions revoked' },
          400: { description: 'Invalid or expired reset token' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque token',
      },
    },
  },
}