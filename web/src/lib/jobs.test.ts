import { describe, expect, it } from "vitest"

import type { JobStatusResponse } from "./jobs"
import { waitForJob } from "./jobs"

function status(partial: Partial<JobStatusResponse>): JobStatusResponse {
  return {
    id: "job1",
    tool: "lock",
    status: "queued",
    position: null,
    queue_size: 0,
    error: null,
    file_count: 1,
    total_bytes: 10,
    created_at: 0,
    ...partial,
  }
}

describe("waitForJob", () => {
  it("polls until done and reports queue position", async () => {
    const sequence = [
      status({ status: "queued", position: 2, queue_size: 3 }),
      status({ status: "processing" }),
      status({ status: "done" }),
    ]
    const seen: Array<{ phase: string; position?: number | null }> = []
    const result = await waitForJob("job1", {
      getStatus: async () => sequence.shift()!,
      delayMs: 0,
      onProgress: (p) => seen.push({ phase: p.phase, position: p.position }),
    })
    expect(result.status).toBe("done")
    expect(seen).toEqual([
      { phase: "queued", position: 2 },
      { phase: "processing", position: undefined },
    ])
  })

  it("throws the job's error message when it fails", async () => {
    await expect(
      waitForJob("job1", {
        getStatus: async () => status({ status: "failed", error: "Wrong password." }),
        delayMs: 0,
      }),
    ).rejects.toThrow("Wrong password.")
  })
})
