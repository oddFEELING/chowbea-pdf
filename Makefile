# Convenience commands for running the Chowbea PDF monorepo.
# `make dev` runs the API and web app together; Ctrl-C stops both.

.PHONY: help dev api web install codegen rabbit

help:
	@echo "Targets:"
	@echo "  make install   Install API (uv) and web (bun) dependencies"
	@echo "  make dev       Run the API and web app together"
	@echo "  make api       Run only the FastAPI backend (port 8000)"
	@echo "  make web       Run only the web dev server (port 3000)"
	@echo "  make codegen   Watch the API spec and regenerate the typed client"
	@echo "  make rabbit    Start a local RabbitMQ container (needed by make dev)"

install:
	cd api && uv sync
	cd web && bun install

# Run both servers in the same process group and tear them down together.
dev:
	@trap 'kill 0' INT TERM EXIT; \
	(cd api && uv run uvicorn app.main:app --reload --port 8000) & \
	(cd web && bun run dev) & \
	wait

api:
	cd api && uv run uvicorn app.main:app --reload --port 8000

web:
	cd web && bun run dev

codegen:
	cd web && bun api:watch

# Local broker for the job queue; management UI at http://localhost:15672 (guest/guest).
rabbit:
	@docker start chowbea-rabbit 2>/dev/null || docker run -d --name chowbea-rabbit \
		-p 5672:5672 -p 15672:15672 rabbitmq:4-management
