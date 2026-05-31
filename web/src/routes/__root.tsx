import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { ThemeProvider } from "next-themes"

import { ThemeToggle } from "@/components/theme-toggle"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "description",
        content: "Compress and process your PDF files quickly and privately.",
      },
      {
        title: "Chowbea PDF",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class on the client.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {/* Scrolls on mobile (the stacked layout needs the room); locked to a
              single screen from md up where the grid has space to breathe. */}
          <div className="flex min-h-svh flex-col md:h-svh md:overflow-hidden">
            {/* Centered max-width column, framed with side borders. */}
            <div className="mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col border-border sm:border-x">
            {/* Top bar: mono wordmark on the left, theme switch as its own cell. */}
            <header className="flex h-14 shrink-0 items-stretch justify-between border-b">
              <Link to="/" className="flex items-center border-r px-4 sm:px-5">
                <span className="flex items-center gap-1.5 font-mono text-sm font-medium uppercase tracking-[0.18em]">
                  Chowbea
                  <span className="text-muted-foreground/40">/</span>
                  <span className="text-[#ff9800]">PDF</span>
                </span>
              </Link>
              <ThemeToggle />
            </header>
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            </div>
          </div>
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
