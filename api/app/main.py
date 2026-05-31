"""FastAPI application entrypoint for the Chowbea PDF API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import pdf

# The OpenAPI document produced here is consumed by the web app's `chowbea-axios`
# codegen to generate a fully typed client.
app = FastAPI(title=settings.app_name, version=settings.app_version)

# Allow the browser-based frontend to call the API during development and in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Original-Size", "X-Compressed-Size", "Content-Disposition"],
)

app.include_router(pdf.router)


@app.get("/health", tags=["meta"], summary="Liveness check")
def health() -> dict[str, str]:
    """Return a simple status payload used by load balancers and uptime checks."""
    return {"status": "ok"}
