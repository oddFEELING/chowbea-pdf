import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import type { IconSvgElement } from "@hugeicons/react"

/**
 * The header for a focused tool flow: an "ALL TOOLS" back chip, then an amber
 * icon block beside the oversized, uppercase tool title and its one-line intro.
 */
export function ToolHeader({
  icon,
  title,
  subtitle,
}: {
  icon: IconSvgElement
  title: string
  subtitle: string
}) {
  return (
    <div className="mt-8">
      <Link
        to="/"
        className="press inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-ink shadow-block-sm"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" strokeWidth={2.6} />
        All tools
      </Link>

      <div className="mt-5 flex items-center gap-4 sm:gap-[18px]">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[15px] border-2 border-ink bg-amber text-ink shadow-block-sm sm:size-[60px]">
          <HugeiconsIcon icon={icon} className="size-7 sm:size-[30px]" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-[44px]">
            {title}
          </h1>
          <p className="mt-1.5 text-[15px] font-semibold text-subtext sm:text-base">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}
