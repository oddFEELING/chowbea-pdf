import { create } from "zustand"

import type { CompressionProgress, ConvertResult, ConvertTarget } from "@/lib/api"
import type { ToolStatus } from "./status"

interface ConvertState {
  files: File[]
  target: ConvertTarget | null
  dpi: number
  status: ToolStatus
  result: ConvertResult | null
  error: string | null
  progress: CompressionProgress | null
  reset: () => void
}

const initialState = {
  files: [] as File[],
  target: null as ConvertTarget | null,
  dpi: 150,
  status: "idle" as ToolStatus,
  result: null as ConvertResult | null,
  error: null as string | null,
  progress: null as CompressionProgress | null,
}

/** Module-level store: survives route unmounts, so leaving the page mid-job
loses nothing — in-flight submit callbacks keep writing here. */
export const useConvertStore = create<ConvertState>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
}))
