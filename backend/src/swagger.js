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
    description: 'REST API for the ProductHub SPA catalog (Express + SQLite).',
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
  },
}