import * as React from "react"
import { useInView } from "motion/react"
import { annotate } from "rough-notation"
import type { RoughAnnotation } from "rough-notation/lib/model"

type AnnotationAction =
  | "highlight"
  | "underline"
  | "box"
  | "circle"
  | "strike-through"
  | "crossed-off"
  | "bracket"

interface HighlighterProps {
  children: React.ReactNode
  action?: AnnotationAction
  color?: string
  strokeWidth?: number
  animationDuration?: number
  iterations?: number
  padding?: number
  multiline?: boolean
}

/**
 * Wraps inline text with a hand-drawn rough-notation annotation (underline,
 * box, circle, etc.). The scribble is drawn once the element scrolls into view
 * and is redrawn whenever its size changes so it always tracks the text.
 */
export function Highlighter({
  children,
  action = "underline",
  color = "#ff9800",
  strokeWidth = 2,
  animationDuration = 700,
  iterations = 2,
  padding = 2,
  multiline = true,
}: HighlighterProps) {
  const elementRef = React.useRef<HTMLSpanElement>(null)
  const annotationRef = React.useRef<RoughAnnotation | null>(null)
  const isInView = useInView(elementRef, { once: true, margin: "-10%" })

  React.useEffect(() => {
    if (!isInView) return
    const element = elementRef.current
    if (!element) return

    const annotation = annotate(element, {
      type: action,
      color,
      strokeWidth,
      animationDuration,
      iterations,
      padding,
      multiline,
    })
    annotationRef.current = annotation
    annotation.show()

    // Keep the scribble aligned with the text as the layout reflows.
    const resizeObserver = new ResizeObserver(() => {
      annotation.hide()
      annotation.show()
    })
    resizeObserver.observe(element)
    resizeObserver.observe(document.body)

    return () => {
      annotate(element, { type: action }).remove()
      resizeObserver.disconnect()
    }
  }, [isInView, action, color, strokeWidth, animationDuration, iterations, padding, multiline])

  return (
    <span ref={elementRef} className="relative inline-block bg-transparent">
      {children}
    </span>
  )
}
