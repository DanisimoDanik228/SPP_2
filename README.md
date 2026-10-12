# SPA CRUD Application — ProductHub

Full-stack single-page application for managing a product catalog with **no page reloads**.

## Technologies

**Frontend:**
- React 19
- Vite 8
- TypeScript

**Backend:**
- Node.js 24
- Express
- better-sqlite3 (SQLite)

**Infrastructure:**
- Docker
- Docker Compose
- nginx (static frontend + reverse proxy to the API)

## Project structure

```
SPP_2/
├── backend/                # Node.js REST API
│   ├── src/
│   │   ├── routes/         # products and authentication endpoints
│   │   ├── services/       # catalog and authentication services
│   │   ├── middlewares/    # authorization and image validation
│   │   ├── routes/         # products routes (CRUD)
│   │   ├── services/       # productService (queries, file deletion)
│   │   ├── middlewares/    # multer upload (image validation)
│   │   ├── utils/          # server-side validation
│   │   ├── db.js           # SQLite connection + schema init
│   │   ├── app.js          # express app (CORS, static /uploads, Swagger)
│   │   ├── server.js       # entry point
│   │   ├── swagger.js      # OpenAPI document
│   ├── data/               # SQLite database (docker volume)
│   ├── uploads/            # uploaded product images (docker volume)
│   ├── package.json
│   └── Dockerfile
├── Laba2-ui/               # React + Vite frontend
│   ├── src/
│   │   ├── components/     # ProductCard, ProductModal, ProductForm, SearchBar, ...
│   │   ├── pages/          # ProductsPage
│   │   ├── services/       # api.ts
│   │   ├── types/          # product.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── nginx.conf          # serves build + proxies /api and /uploads to the API
│   └── Dockerfile
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Run

### Option 1 — Docker Compose (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API / health: http://localhost:8080
- Swagger: http://localhost:8080/swagger

The SQLite database and uploaded images are stored in bind-mount volumes (`./data`, `./uploads`) and survive container restarts.

Authentication and recovery require environment configuration. Create a local `.env` file (do not commit it) before starting Compose:

```dotenv
AUTH_ADMIN_EMAIL=admin@example.com
AUTH_ADMIN_PASSWORD=replace-with-a-unique-password-of-at-least-12-characters
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mailer@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=ProductHub <mailer@example.com>
```

The configured admin account is created on first startup only; changing these variables will not overwrite an existing account. New registrations receive the `viewer` role. An administrator can promote users to `editor` (catalog read/write) or `admin` (user and role management) using **Manage users**. Public catalog reads remain available. All access keys are random, time-limited bearer tokens; passwords are stored using scrypt hashes. The default key lifetime is 8 hours and at most 3 live sessions per user are allowed. Sessions can be listed and revoked through the authentication API. Password recovery tokens are single-use and expire after 30 minutes; configure SMTP to deliver recovery messages. Use HTTPS in production.

### Option 2 — Local development

Backend (port 8080):

```bash
cd backend
npm install
npm run dev
```

Frontend (port 5173, proxies `/api` and `/uploads` to `http://localhost:8080`):

```bash
cd Laba2-ui
npm install
npm run dev
```

## REST API

| Method | Route                   | Body type          | Success |
| ------ | ----------------------- | ------------------ | ------- |
| GET    | `/api/products`         | —                  | 200     |
| GET    | `/api/products?search=` | —                  | 200     |
| GET    | `/api/products/{id}`    | —                  | 200     |
| POST   | `/api/products`         | `multipart/form-data` | 201  |
| PUT    | `/api/products/{id}`    | `multipart/form-data` | 200  |
| DELETE | `/api/products/{id}`    | —                  | 204     |

Common errors: `400 Bad Request` (validation), `404 Not Found` (missing product).

Product creation, update and deletion require an authenticated `editor` or `admin` account. Missing/expired credentials return `401`, insufficient role returns `403`, throttled authentication requests return `429` with `Retry-After`, oversized requests return `413`, and unsupported image types return `415`. API errors include a request ID; HTTP access and server errors are emitted as structured JSON logs without credentials or request bodies.

Authentication endpoints:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a viewer account and start a session |
| POST | `/api/auth/login` | Verify credentials and issue a temporary bearer key |
| POST | `/api/auth/logout` | Revoke the current session |
| GET | `/api/auth/me` | Get the current account and role |
| GET / DELETE | `/api/auth/sessions` (`/:id` for DELETE) | List or revoke active sessions |
| POST | `/api/auth/password/forgot` | Send a time-limited reset token by email |
| POST | `/api/auth/password/reset` | Consume a reset token and set a new password |
| GET | `/api/auth/users` | List accounts (admin only) |
| PATCH | `/api/auth/users/{id}/role` | Change an account role (admin only) |

Login failures are rate-limited by account and client IP; recovery requests are rate-limited by IP. The initial admin can be bootstrapped with `AUTH_ADMIN_EMAIL` and `AUTH_ADMIN_PASSWORD`. Never use default or shared passwords. SMTP and bootstrap secrets should be supplied by a secret manager in production.

`POST /api/products` fields:

```
name         (required, 2–100 chars)
description  (optional, ≤ 500 chars)
price        (required, > 0)
category     (required, 2–50 chars)
image        (optional file: jpg/jpeg/png/gif/webp, ≤ 5 MB)
```

Example response:

```json
{
  "id": 1,
  "name": "MacBook Pro",
  "description": "Notebook",
  "price": 1999.99,
  "category": "Laptops",
  "imageUrl": "/uploads/abcd.jpg",
  "createdAt": "2026-09-22T10:00:00.000Z"
}
```

Validation errors return:

```json
{
  "message": "Validation failed",
  "errors": {
    "name": ["Name is required."],
    "price": ["Price must be greater than 0."]
  }
}
```

## Swagger

Open http://localhost:8080/swagger to test every endpoint, including `multipart/form-data` uploads (use the "Try it out" button).

## Automated checks

GitHub Actions runs the backend syntax/integration tests and the frontend lint/build checks on every push and pull request. Locally run `cd backend && npm run check && npm test`, then `cd Laba2-ui && npm run lint && npm run build`.

## Frontend features

- Product cards with image, category badge, price, Edit/Delete actions
- Search with debounce (`GET /api/products?search=...`)
- Add / Edit modal with image preview
- Delete confirmation dialog
- Toast notifications for every CRUD operation
- Loading skeletons, empty state, and error state with "Try again"
- Fully responsive layout; the page never reloads during CRUD

## Local run details

- Backend listens on `http://localhost:8080` (default, configurable via `PORT`).
- CORS is allowed for `http://localhost:5173`, `http://localhost:8080` and the Docker `frontend` service.
- The SQLite file is created automatically on first start (`data/products.db`), uploads go to `uploads/`.
- `/uploads/*` files are served as static content by the API.