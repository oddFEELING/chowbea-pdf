import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Download04Icon,
  Loading03Icon,
  Pdf01Icon,
  SquareLockPasswordIcon,
  SquareUnlock02Icon,
  Upload04Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  type CompressionProgress,
  type UnlockResult,
  downloadBlob,
  formatBytes,
  unlockPdf,
} from "@/lib/api"

export const Route = createFileRoute("/unlock")({ component: UnlockPage })

// Human-readable labels for each phase of an in-flight unlock request.
const PHASE_LABELS: Record<CompressionProgress["phase"], string> = {
  uploading: "Uploading",
  processing: "Unlocking",
  downloading: "Downloading",
}

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

function UnlockPage() {
  const [file, setFile] = React.useState<File | null>(null)
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [status, setStatus] = React.useState<Status>("idle")
  const [result, setResult] = React.useState<UnlockResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<CompressionProgress | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Keep only the first PDF picked — unlock works on a single file at a time.
  const pickFile = React.useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return
    const pdf = Array.from(incoming).find(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    )
    if (!pdf) return
    setFile(pdf)
    setStatus("idle")
    setResult(null)
    setError(null)
  }, [])

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    pickFile(event.dataTransfer.files)
  }

  const handleUnlock = async () => {
    if (!file || password.length === 0) return
    setStatus("loading")
    setError(null)
    setResult(null)
    setProgress({ phase: "uploading", percent: 0 })
    try {
      const unlocked = await unlockPdf(file, password, setProgress)
      setResult(unlocked)
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setStatus("error")
    } finally {
      setProgress(null)
    }
  }

  const canSubmit = Boolean(file) && password.length > 0 && status !== "loading"

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
            <HugeiconsIcon icon={SquareUnlock02Icon} className="size-5" strokeWidth={1.8} />
          </span>
          <div className="flex flex-col">
            <h1 className="font-heading text-lg font-semibold tracking-tight">Unlock PDF</h1>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Remove a known password
            </span>
          </div>
        </div>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
          {file ? formatBytes(file.size) : "No file yet"}
        </span>
      </div>

      {/* ── Compact, centered workspace ── */}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-8">
        {/* 01 — file */}
        <div className="flex flex-col gap-3">
          <StepLabel step="01">Choose file</StepLabel>

          {!file ? (
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
                  Drop a PDF here or <span className="text-[#ff9800]">browse</span>
                </p>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-muted-foreground">
                  One file at a time
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 border bg-card px-3 py-2.5">
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
                onClick={() => {
                  setFile(null)
                  setStatus("idle")
                  setResult(null)
                }}
                className="flex size-6 shrink-0 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => pickFile(event.target.files)}
          />
        </div>

        {/* 02 — password */}
        <div className="flex flex-col gap-3">
          <StepLabel step="02">Password</StepLabel>
          <div className="flex items-center border focus-within:border-[#ff9800]/60">
            <span className="flex size-10 shrink-0 items-center justify-center border-r text-muted-foreground">
              <HugeiconsIcon icon={SquareLockPasswordIcon} className="size-4" strokeWidth={1.8} />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) handleUnlock()
              }}
              placeholder="PDF password"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="flex size-10 shrink-0 items-center justify-center border-l text-muted-foreground transition-colors hover:text-foreground"
            >
              <HugeiconsIcon icon={showPassword ? ViewOffIcon : ViewIcon} className="size-4" />
            </button>
          </div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-muted-foreground">
            You must know the password — we never crack it
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleUnlock}
          disabled={!canSubmit}
          className="w-full rounded-none bg-[#ff9800] text-white shadow-[3px_3px_0_0_rgba(0,0,0,0.18)] transition-all hover:bg-[#ff9800]/90 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:shadow-none dark:text-background"
        >
          {status === "loading" ? (
            <>
              <HugeiconsIcon icon={Loading03Icon} className="animate-spin" />
              Unlocking…
            </>
          ) : (
            <>
              <HugeiconsIcon icon={SquareUnlock02Icon} strokeWidth={1.8} />
              Unlock PDF
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
                Unlocked
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              The password has been removed. Your file opens without a prompt now.
            </p>
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
