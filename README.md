# Chowbea PDF

A small monorepo for performing batch actions on PDF files. The first action is
**compression**. See [purpose.md](purpose.md) for the project goal and roadmap.

```
chowbea-pdf/
├── web/   # TanStack Start frontend (React 19, Vite, Tailwind, shadcn, hugeicons) on bun
└── api/   # FastAPI backend (PDF actions, Ghostscript-based compression)
```

## Prerequisites

- [bun](https://bun.sh) >= 1.3
- [uv](https://docs.astral.sh/uv/) (manages Python and dependencies for the API)
- [Ghostscript](https://www.ghostscript.com/) (`gs`) for compression
  - macOS: `brew install ghostscript`
  - Debian/Ubuntu: `apt-get install ghostscript`
  - (Already installed inside the API Docker image.)

## Run everything (recommended)

From the repo root, use the `Makefile`:

```bash
make install   # install API (uv) and web (bun) dependencies
make dev       # run the API and web app together (Ctrl-C stops both)
```

Other targets: `make api`, `make web`, and `make codegen` (watch the API spec and
regenerate the typed client). Run `make help` to list them.

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs · OpenAPI: http://localhost:8000/openapi.json

## Run the apps individually

Backend (`api/`):

```bash
cd api
uv sync                                       # installs Python 3.12 + dependencies
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (`web/`):

```bash
cd web
bun install
bun run dev          # http://localhost:3000
```

To regenerate the typed API client from the running backend:

```bash
bun api:generate     # one-off
bun api:watch        # watch the spec and regenerate on change
```

## Deployment

Each app has its own `Dockerfile` and deploys as an independent service from this
repo (set the service's root directory to `web/` or `api/`).
