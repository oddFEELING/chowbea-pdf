import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload04Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

/**
 * A Bold Blocks file-drop target: dashed ink frame with an amber upload well.
 * Handles click-to-browse, keyboard activation and drag highlighting; the
 * actual <input type="file"> is owned by the caller and triggered via `onPick`.
 */
export function Dropzone({
  onFiles,
  onPick,
  multiple,
  title,
  hint,
}: {
  onFiles: (files: FileList | null) => void
  onPick: () => void
  multiple?: boolean
  title: React.ReactNode
  hint: string
}) {
  const [isDragging, setIsDragging] = React.useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add PDF files"
      onClick={onPick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onPick()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        onFiles(event.dataTransfer.files)
      }}
      className={cn(
        "flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-4 rounded-[20px] border-[3px] border-dashed px-6 py-12 text-center transition-colors",
        isDragging ? "border-ink bg-soft-amber/60" : "border-[#c9b89c] bg-card hover:bg-surface",
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-[16px] border-2 border-ink bg-amber text-ink shadow-block-sm">
        <HugeiconsIcon icon={Upload04Icon} className="size-8" strokeWidth={2.2} />
      </span>
      <div>
        <p className="font-heading text-xl font-extrabold text-ink">{title}</p>
        <p className="mt-1 text-[13px] font-bold uppercase tracking-wide text-muted-ink">{hint}</p>
      </div>
      <span className="pointer-events-none inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-ink shadow-block-sm">
        Browse {multiple ? "files" : "file"}
      </span>
    </div>
  )
}
