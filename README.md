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