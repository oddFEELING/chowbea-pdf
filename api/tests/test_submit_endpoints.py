"""Submit endpoints return 202 + a queued job instead of processing inline."""

from app.jobs.registry import JobStatus


def test_compress_returns_202_with_position(client, registry, fake_queue, pdf_bytes):
    response = client.post(
        "/pdf/compress",
        files=[("files", ("a.pdf", pdf_bytes, "application/pdf"))],
        data={"quality": "ebook"},
    )
    assert response.status_code == 202
    body = response.json()
    record = registry.get(body["job_id"])
    assert record is not None
    assert record.tool == "compress"
    assert record.status is JobStatus.queued
    assert record.params["quality"] == "ebook"
    assert record.params["names"] == ["a.pdf"]
    assert (record.workspace / "input-0.pdf").exists()
    assert body["position"] == 1
    assert body["queue_size"] == 1
    assert fake_queue.published == [body["job_id"]]


def test_lock_stores_params_and_input(client, registry, pdf_bytes):
    response = client.post(
        "/pdf/lock",
        files={"file": ("b.pdf", pdf_bytes, "application/pdf")},
        data={"password": "pw", "encryption": "aes-256"},
    )
    assert response.status_code == 202
    record = registry.get(response.json()["job_id"])
    assert record.tool == "lock"
    assert record.params["password"] == "pw"
    assert record.params["name"] == "b.pdf"
    assert (record.workspace / "input.pdf").exists()


def test_unlock_requires_valid_pdf(client):
    response = client.post(
        "/pdf/unlock",
        files={"file": ("evil.pdf", b"not a pdf", "application/pdf")},
        data={"password": "pw"},
    )
    assert response.status_code == 400


def test_queue_down_returns_503_and_cleans_up(client, registry, fake_queue, pdf_bytes):
    fake_queue.ready = False
    response = client.post(
        "/pdf/unlock",
        files={"file": ("a.pdf", pdf_bytes, "application/pdf")},
        data={"password": "pw"},
    )
    assert response.status_code == 503
    assert registry.queue_size() == 0


def test_unexpected_publish_error_returns_503_and_cleans_up(
    client, registry, fake_queue, pdf_bytes
):
    async def _boom(job_id):
        raise RuntimeError("boom")

    fake_queue.publish = _boom
    response = client.post(
        "/pdf/unlock",
        files={"file": ("a.pdf", pdf_bytes, "application/pdf")},
        data={"password": "pw"},
    )
    assert response.status_code == 503
    assert registry.queue_size() == 0
