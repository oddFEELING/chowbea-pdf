import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  Cancel01Icon,
  Download04Icon,
  Loading03Icon,
  Minimize01Icon,
  Pdf01Icon,
  Upload04Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  type CompressionProgress,
  type CompressionQuality,
  type CompressionResult,
  compressPdfs,
  downloadBlob,
  formatBytes,
} from "@/lib/api"

export const Route = createFileRoute("/compress")({ component: CompressPage })

// Human-readable labels for each phase of an in-flight compression request.
const PHASE_LABELS: Record<CompressionProgress["phase"], string> = {
  uploading: "Uploading",
  processing: "Compressing",
  downloading: "Downloading",
}

// Quality presets shown in the segmented selector, mirroring the API's enum.
const QUALITY_OPTIONS: Array<{
  value: CompressionQuality
  label: string
  hint: string
}> = [
  { value: "screen", label: "Smallest", hint: "72 dpi" },
  { value: "ebook", label: "Recommended", hint: "150 dpi" },
  { value: "printer", label: "High", hint: "300 dpi" },
  { value: "prepress", label: "Maximum", hint: "300 dpi+" },
]

type Status = "idle" | "loading" | "success" | "error"

// A small mono section label used to number the workspace steps.
function StepLabel({ step, children }: { step: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
      <span className="font-medium text-foreground">{step}</span>
      {children}
    </span>
  )
}

function CompressPage() {
  const [files, setFiles] = React.useState<File[]>([])
  const [quality, setQuality] = React.useState<CompressionQuality>("ebook")
  const [status, setStatus] = React.useState<Status>("idle")
  const [result, setResult] = React.useState<CompressionResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<CompressionProgress | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Merge newly picked files into state, keeping only PDFs and skipping duplicates.
  const addFiles = React.useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const pdfs = Array.from(incoming).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    )
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`))
      const unique = pdfs.filter((f) => !seen.has(`${f.name}:${f.size}`))
      return [...current, ...unique]
    })
    setStatus("idle")
    setResult(null)
    setError(null)
  }, [])

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index))
    setStatus("idle")
    setResult(null)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const handleCompress = async () => {
    if (files.length === 0) return
    setStatus("loading")
    setError(null)
    setResult(null)
    setProgress({ phase: "uploading", percent: 0 })
    try {
      const compressed = await compressPdfs(files, quality, setProgress)
      setResult(compressed)
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setStatus("error")
    } finally {
      setProgress(null)
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const savedRatio =
    result && result.originalSize > 0
      ? Math.max(0, 1 - result.compressedSize / result.originalSize)
      : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* ── Tool header strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            aria-label="Back to all tools"
            className="flex size-9 items-center justify-center border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" strokeWidth={1.8} />
          </Link>
          <span className="flex size-10 items-center justify-center border bg-muted/40 text-muted-foreground">
            <HugeiconsIcon icon={Minimize01Icon} className="size-5" strokeWidth={1.8} />
          </span>
          <div className="flex flex-col">
            <h1 className="font-heading text-lg font-semibold tracking-tight">Compress PDFs</h1>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Powered by Ghostscript
            </span>
          </div>
        </div>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
          {files.length > 0 ? `${files.length} queued · ${formatBytes(totalSize)}` : "No files yet"}
        </span>
      </div>

      {/* ── Compact, centered workspace ── */}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-8">
        {/* 01 — files */}
        <div className="flex flex-col gap-3">
          <StepLabel step="01">Add files</StepLabel>

          {files.length === 0 ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click()
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 border border-dashed text-center transition-colors",
                isDragging
                  ? "border-[#ff9800] bg-[#ff9800]/5"
                  : "border-border hover:border-foreground/30 hover:bg-muted/30",
              )}
            >
              <div className="flex size-11 items-center justify-center border bg-muted/40 text-muted-foreground">
                <HugeiconsIcon icon={Upload04Icon} className="size-5" strokeWidth={1.8} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drop PDFs here or <span className="text-[#ff9800]">browse</span>
                </p>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-muted-foreground">
                  Multiple files supported
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-px border">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}:${file.size}`}
                    className="flex items-center gap-3 bg-card px-3 py-2.5"
                  >
                    <HugeiconsIcon
                      icon={Pdf01Icon}
                      className="size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.8}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeFile(index)}
                      className="flex size-6 shrink-0 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center justify-center gap-2 border border-dashed border-border py-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
                Add more
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(event) => addFiles(event.target.files)}
          />
        </div>

        {/* 02 — quality */}
        <div className="flex flex-col gap-3">
          <StepLabel step="02">Quality</StepLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setQuality(option.value)}
                className={cn(
                  "-mr-px -mb-px flex flex-col gap-0.5 border p-3 text-left transition-colors",
                  quality === option.value
                    ? "border-[#ff9800] bg-[#ff9800]/5"
                    : "border-border hover:bg-muted/30",
                )}
              >
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-muted-foreground">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          onClick={handleCompress}
          disabled={files.length === 0 || status === "loading"}
          className="w-full rounded-none bg-[#ff9800] text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.18)] transition-all hover:bg-[#ff9800]/90 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:shadow-none dark:text-background"
        >
          {status === "loading" ? (
            <>
              <HugeiconsIcon icon={Loading03Icon} className="animate-spin" />
              Compressing…
            </>
          ) : (
            <>
              <HugeiconsIcon icon={Minimize01Icon} strokeWidth={1.8} />
              Compress{files.length > 0 ? ` ${files.length} file${files.length > 1 ? "s" : ""}` : ""}
            </>
          )}
        </Button>

        {/* Progress */}
        {status === "loading" && progress && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
              <span>{PHASE_LABELS[progress.phase]}…</span>
              {progress.percent !== null && (
                <span className="tabular-nums">{Math.round(progress.percent)}%</span>
              )}
            </div>
            {progress.percent !== null ? (
              <Progress value={progress.percent} className="rounded-none" />
            ) : (
              <div className="h-1.5 w-full overflow-hidden bg-muted">
                <div className="animate-indeterminate h-full w-2/5 bg-[#ff9800]" />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {status === "error" && error && (
          <p className="border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}

        {/* Result */}
        {status === "success" && result && (
          <motion.div
            className="flex flex-col gap-4 border border-[#ff9800]/40 bg-[#ff9800]/[0.04] p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-center justify-between">
              <StepLabel step="03">Done</StepLabel>
              <span className="border border-[#ff9800]/40 bg-[#ff9800]/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.15em] text-[#ff9800]">
                {Math.round(savedRatio * 100)}% smaller
              </span>
            </div>
            <div className="flex items-baseline gap-3 font-mono">
              <span className="text-muted-foreground line-through">
                {formatBytes(result.originalSize)}
              </span>
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                className="size-4 rotate-180 text-muted-foreground"
              />
              <span className="text-lg font-semibold text-foreground">
                {formatBytes(result.compressedSize)}
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-none"
              onClick={() => downloadBlob(result.blob, result.filename)}
            >
              <HugeiconsIcon icon={Download04Icon} />
              Download {result.filename}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
