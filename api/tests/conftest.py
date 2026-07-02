"""Shared fixtures: a TestClient with a fresh registry and a fake queue.

The TestClient is used without its context manager so the app lifespan (which
connects to RabbitMQ) never runs; app.state is populated by hand instead.
"""

import pikepdf
import pytest
from fastapi.testclient import TestClient

from app.jobs.queue import QueueUnavailableError
from app.jobs.registry import JobRegistry
from app.main import app


class FakeQueue:
    def __init__(self) -> None:
        self.published: list[str] = []
        self.ready = True

    async def publish(self, job_id: str) -> None:
        if not self.ready:
            raise QueueUnavailableError("queue down")
        self.published.append(job_id)


@pytest.fixture
def fake_queue() -> FakeQueue:
    return FakeQueue()


@pytest.fixture
def registry() -> JobRegistry:
    return JobRegistry()


@pytest.fixture
def client(registry, fake_queue) -> TestClient:
    app.state.registry = registry
    app.state.job_queue = fake_queue
    return TestClient(app)


@pytest.fixture
def pdf_bytes(tmp_path) -> bytes:
    path = tmp_path / "sample.pdf"
    pdf = pikepdf.new()
    pdf.add_blank_page()
    pdf.save(path)
    pdf.close()
    return path.read_bytes()
