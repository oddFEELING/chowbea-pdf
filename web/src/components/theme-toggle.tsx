import * as React from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons"

/**
 * A small bordered chip that toggles between light and dark themes.
 *
 * Rendering of the icon is deferred until after mount so the server-rendered
 * markup matches the client (the actual theme is only known in the browser).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex cursor-pointer items-center justify-center border-l px-4 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground sm:px-5"
    >
      {/* Keep layout stable before mount by reserving the icon's size. */}
      {mounted ? (
        <HugeiconsIcon
          icon={isDark ? Sun01Icon : Moon02Icon}
          className="size-[18px]"
          strokeWidth={1.8}
        />
      ) : (
        <span className="block size-[18px]" />
      )}
    </button>
  )
}
