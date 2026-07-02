"""In-process job registry: the single source of truth for job state and order.

RabbitMQ carries the work, but it cannot answer "where am I in line?", so the
registry keeps an insertion-ordered record of every job in this process. The
app runs a single uvicorn process with one replica, so no cross-process
coherence is needed.
"""

from __future__ import annotations

import shutil
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    failed = "failed"


@dataclass
class JobRecord:
    """Everything the API needs to report on and finish one job.

    `params` may hold passwords, so records must never be logged or serialized
    wholesale; only the fields exposed by the schemas leave the process.
    """

    id: str
    tool: str
    workspace: Path
    file_count: int
    total_bytes: int
    params: dict[str, Any] = field(default_factory=dict, repr=False)
    status: JobStatus = JobStatus.queued
    error: str | None = None
    result_path: Path | None = None
    download_name: str | None = None
    media_type: str | None = None
    result_headers: dict[str, str] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    finished_at: float | None = None


class JobRegistry:
    """Insertion-ordered job store with TTL-based cleanup of finished jobs."""

    def __init__(self, result_ttl_seconds: float = 30 * 60) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._ttl = result_ttl_seconds

    def create(
        self,
        *,
        tool: str,
        workspace: Path,
        file_count: int,
        total_bytes: int,
        params: dict[str, Any],
    ) -> JobRecord:
        record = JobRecord(
            id=uuid.uuid4().hex,
            tool=tool,
            workspace=workspace,
            file_count=file_count,
            total_bytes=total_bytes,
            params=params,
        )
        self._jobs[record.id] = record
        return record

    def get(self, job_id: str) -> JobRecord | None:
        return self._jobs.get(job_id)

    def discard(self, job_id: str) -> None:
        """Remove a job and its workspace (e.g. when enqueueing failed)."""
        record = self._jobs.pop(job_id, None)
        if record is not None:
            shutil.rmtree(record.workspace, ignore_errors=True)

    def position(self, job_id: str) -> int | None:
        """1-based place among queued jobs; None once started or unknown."""
        record = self._jobs.get(job_id)
        if record is None or record.status is not JobStatus.queued:
            return None
        place = 1
        for other in self._jobs.values():
            if other.id == job_id:
                return place
            if other.status is JobStatus.queued:
                place += 1
        return None

    def queue_size(self) -> int:
        return sum(1 for r in self._jobs.values() if r.status is JobStatus.queued)

    def processing(self) -> list[JobRecord]:
        return [r for r in self._jobs.values() if r.status is JobStatus.processing]

    def waiting(self) -> list[JobRecord]:
        return [r for r in self._jobs.values() if r.status is JobStatus.queued]

    def sweep(self, now: float | None = None) -> int:
        """Delete finished jobs past the TTL, workspace included."""
        now = time.time() if now is None else now
        expired = [
            r
            for r in self._jobs.values()
            if r.finished_at is not None and now - r.finished_at >= self._ttl
        ]
        for record in expired:
            shutil.rmtree(record.workspace, ignore_errors=True)
            del self._jobs[record.id]
        return len(expired)
