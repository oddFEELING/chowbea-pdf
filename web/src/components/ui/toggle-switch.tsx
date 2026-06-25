import { cn } from "@/lib/utils"

/**
 * A Bold Blocks on/off switch: ink-outlined pill that fills amber when on, with
 * a solid ink knob that slides to the active side.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-7 w-[50px] shrink-0 items-center rounded-full border-2 border-ink p-0.5 transition-colors",
        checked ? "justify-end bg-amber" : "justify-start bg-card",
      )}
    >
      <span className="size-5 rounded-full bg-ink" />
    </button>
  )
}
