import * as React from "react"
import { animate } from "motion/react"

import { fetchQueueBoard } from "@/lib/jobs"

/** Lifetime jobs-performed chip for the header. Renders nothing until the
count arrives and never shows zero — the site shouldn't advertise "0 jobs
done". Hidden on small screens where the header has no room for it. */
export function JobsCounter() {
  const [count, setCount] = React.useState<number | null>(null)
  const [display, setDisplay] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    fetchQueueBoard()
      .then((board) => {
        if (!cancelled && typeof board.jobs_completed === "number") {
          setCount(board.jobs_completed)
        }
      })
      .catch(() => {
        // Show nothing rather than an error state.
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (count === null || count === 0) return
    const controls = animate(0, count, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (value) => setDisplay(Math.round(value)),
    })
    return () => controls.stop()
  }, [count])

  if (count === null || count === 0) return null
  return (
    <span className="hidden items-center gap-2 rounded-full border-2 border-ink bg-amber px-4 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-ink shadow-block-sm sm:inline-flex">
      <span className="tabular-nums">{display.toLocaleString()}</span> jobs done
    </span>
  )
}
