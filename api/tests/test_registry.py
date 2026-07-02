"""Behavior of the in-process job registry: ordering, position, TTL sweep."""

import time

from app.jobs.registry import JobRegistry, JobStatus


def make_job(registry, tmp_path, name):
    workspace = tmp_path / name
    workspace.mkdir()
    return registry.create(
        tool="compress", workspace=workspace, file_count=1, total_bytes=100, params={}
    )


def test_position_is_one_based_and_ordered(tmp_path):
    registry = JobRegistry()
    first = make_job(registry, tmp_path, "a")
    second = make_job(registry, tmp_path, "b")
    assert registry.position(first.id) == 1
    assert registry.position(second.id) == 2
    assert registry.queue_size() == 2


def test_position_skips_non_queued_jobs(tmp_path):
    registry = JobRegistry()
    first = make_job(registry, tmp_path, "a")
    second = make_job(registry, tmp_path, "b")
    first.status = JobStatus.processing
    assert registry.position(first.id) is None
    assert registry.position(second.id) == 1
    assert registry.queue_size() == 1
    assert [r.id for r in registry.processing()] == [first.id]
    assert [r.id for r in registry.waiting()] == [second.id]


def test_position_unknown_job_is_none(tmp_path):
    registry = JobRegistry()
    assert registry.position("nope") is None
    assert registry.get("nope") is None


def test_discard_removes_job_and_workspace(tmp_path):
    registry = JobRegistry()
    record = make_job(registry, tmp_path, "a")
    assert record.workspace.exists()
    registry.discard(record.id)
    assert registry.get(record.id) is None
    assert not record.workspace.exists()


def test_sweep_removes_only_expired_finished_jobs(tmp_path):
    registry = JobRegistry(result_ttl_seconds=1800)
    old = make_job(registry, tmp_path, "old")
    fresh = make_job(registry, tmp_path, "fresh")
    queued = make_job(registry, tmp_path, "queued")
    now = time.time()
    old.status = JobStatus.done
    old.finished_at = now - 3600
    fresh.status = JobStatus.failed
    fresh.finished_at = now - 60
    removed = registry.sweep(now=now)
    assert removed == 1
    assert registry.get(old.id) is None
    assert not old.workspace.exists()
    assert registry.get(fresh.id) is not None
    assert registry.get(queued.id) is not None
