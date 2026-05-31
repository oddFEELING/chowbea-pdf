import { createFileRoute, Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Files01Icon,
  Image01Icon,
  Layers01Icon,
  Minimize01Icon,
  SquareLock01Icon,
  SquareUnlock02Icon,
} from "@hugeicons/core-free-icons"

import { Highlighter } from "@/components/ui/highlighter"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({ component: Home })

// Shared easing for the entrance animations (a crisp ease-out-quart).
const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as [number, number, number, number]

type Tool = {
  name: string
  description: string
  icon: typeof Minimize01Icon
  to?: string
}

// The launcher grid. Only Compress is live; the rest advertise what's coming.
const TOOLS: Tool[] = [
  {
    name: "Compress",
    description: "Shrink PDF file size while keeping it readable.",
    icon: Minimize01Icon,
    to: "/compress",
  },
  {
    name: "Unlock",
    description: "Remove a known password from a PDF.",
    icon: SquareUnlock02Icon,
    to: "/unlock",
  },
  { name: "Merge", description: "Combine several PDFs into a single file.", icon: Layers01Icon },
  { name: "Split", description: "Break one PDF into separate files.", icon: Files01Icon },
  { name: "PDF to Images", description: "Export each page as an image.", icon: Image01Icon },
  { name: "Protect", description: "Lock a PDF with a password.", icon: SquareLock01Icon },
]

function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
      {/* ── Hero: oversized headline with a hand-drawn accent ── */}
      <header className="flex shrink-0 flex-col justify-center gap-5 border-b px-5 py-14 transition-colors duration-300 hover:bg-muted/20 sm:px-8 sm:py-16 lg:py-20">
        {/* No entrance motion here: rough-notation draws relative to the static
            element, so animating the heading would misplace the underline. */}
        <h1 className="max-w-3xl font-heading text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
          Simple, free PDF tools.{" "}
          <Highlighter action="underline" color="#ff9800" strokeWidth={3}>
            No bullshit.
          </Highlighter>
        </h1>
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">
          Pick a tool below. Everything runs on demand and your files are never stored.
        </p>
      </header>

      {/* ── Tool grid: collapsed hairline cells that fill the rest of the screen ── */}
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool, index) => {
          const isActive = Boolean(tool.to)

          const inner = (
            <motion.div
              className="flex h-full flex-col justify-between gap-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + index * 0.06, ease: EASE_OUT_QUART }}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "flex size-11 items-center justify-center border border-border bg-muted/40 text-muted-foreground transition-colors",
                    isActive && "group-hover:border-foreground/30 group-hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon icon={tool.icon} className="size-5" strokeWidth={1.8} />
                </span>
                {isActive ? (
                  <span className="flex items-center gap-1.5 font-mono text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-[#ff9800]" />
                    Live
                  </span>
                ) : (
                  <span className="border border-border px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
                    Soon
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <h3
                    className={cn(
                      "font-heading text-xl font-semibold tracking-tight",
                      !isActive && "text-muted-foreground",
                    )}
                  >
                    {tool.name}
                  </h3>
                  {isActive && (
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-5 -translate-x-1.5 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  )}
                </div>
                <p
                  className={cn(
                    "text-sm",
                    isActive ? "text-muted-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {tool.description}
                </p>
              </div>
            </motion.div>
          )

          const cellClass =
            "group relative -mr-px -mb-px flex flex-col border p-5 transition-colors duration-300 sm:p-6"

          return tool.to ? (
            <Link key={tool.name} to={tool.to} className={cn(cellClass, "hover:bg-muted/30")}>
              {inner}
            </Link>
          ) : (
            <div key={tool.name} className={cn(cellClass, "cursor-default hover:bg-muted/20")}>
              {inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}
