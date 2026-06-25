import { HugeiconsIcon } from "@hugeicons/react"
import { Coffee02Icon } from "@hugeicons/core-free-icons"

// The creator's Buy Me a Coffee page. (BMC has no reliable preset-amount URL
// param, so every control just opens the page.)
const BMC_URL = "https://buymeacoffee.com/alawodeemmd"

const PRESETS = ["$3", "$5", "$10"]

/**
 * The footer ask on a free, ad-free tool: an ink panel on an amber shadow with
 * preset amounts beside one warm "Buy me a coffee" call to action.
 */
export function CoffeeBlock() {
  return (
    <div className="mt-9 flex flex-col items-start gap-7 rounded-[22px] border-2 border-ink bg-ink p-7 shadow-amber-lg sm:flex-row sm:items-center sm:gap-8 sm:px-9">
      <span className="flex size-[72px] shrink-0 items-center justify-center rounded-[18px] border-2 border-ink bg-amber text-ink">
        <HugeiconsIcon icon={Coffee02Icon} className="size-9" strokeWidth={2.2} />
      </span>

      <div className="flex-1">
        <h2 className="font-heading text-2xl font-extrabold text-cream sm:text-[26px]">
          Chowbea is free &amp; ad-free
        </h2>
        <p className="mt-1 max-w-[480px] text-[15px] font-semibold text-[#c9b89c]">
          Your files never leave the browser. If Chowbea saved you a headache, buy me a coffee to
          keep the servers warm.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {PRESETS.map((amount, i) => (
          <a
            key={amount}
            href={BMC_URL}
            target="_blank"
            rel="noreferrer"
            className={
              i === 1
                ? "rounded-xl border-2 border-ink bg-amber px-4 py-3 text-[15px] font-extrabold text-ink"
                : "rounded-xl border-2 border-[#5a4a35] px-4 py-3 text-[15px] font-extrabold text-cream transition-colors hover:border-amber"
            }
          >
            {amount}
          </a>
        ))}
        <a
          href={BMC_URL}
          target="_blank"
          rel="noreferrer"
          className="press inline-flex items-center gap-2.5 rounded-xl border-2 border-ink bg-amber px-6 py-3 font-heading text-base font-extrabold text-ink shadow-[4px_4px_0_var(--cream)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          <HugeiconsIcon icon={Coffee02Icon} className="size-5" strokeWidth={2.2} />
          Buy me a coffee
        </a>
      </div>
    </div>
  )
}
