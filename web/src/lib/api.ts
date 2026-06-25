/**
 * Client helpers for the Chowbea PDF API.
 *
 * The compress endpoint streams back a binary file (a single PDF or a ZIP of
 * several), so we call it with axios using `responseType: "blob"`. axios also
 * reports upload and download progress, which drives the UI's loading bar.
 */

import axios, { type AxiosProgressEvent } from "axios"

// Base URL of the API, injected at build time by Vite.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

/** Compression presets exposed by the API; ordered smallest to highest quality. */
export const COMPRESSION_QUALITIES = ["screen", "ebook", "printer", "prepress"] as const

export type CompressionQuality = (typeof COMPRESSION_QUALITIES)[number]

/** Phase of an in-flight compression request. */
export type CompressionPhase = "uploading" | "processing" | "downloading"

/** Progress update for the UI; `percent` is null when the phase is indeterminate. */
export interface CompressionProgress {
  phase: CompressionPhase
  percent: number | null
}

/** Result of a successful compression request. */
export interface CompressionResult {
  /** The compressed payload: a PDF for one input, or a ZIP for several. */
  blob: Blob
  /** Suggested download filename parsed from the response. */
  filename: string
  /** Combined size of the uploaded files, in bytes. */
  originalSize: number
  /** Combined size of the compressed output, in bytes. */
  compressedSize: number
}

/** Pull the filename out of a Content-Disposition header, with a fallback. */
function parseFilename(header: string | undefined, fallback: string): string {
  if (!header) return fallback
  const match = /filename="?([^"]+)"?/.exec(header)
  return match?.[1] ?? fallback
}

/** Convert an axios progress event into a 0-100 percentage, or null if unknown. */
function toPercent(event: AxiosProgressEvent): number | null {
  return event.total ? (event.loaded / event.total) * 100 : null
}

/**
 * Compress one or more PDFs and return the resulting file plus size stats.
 *
 * @param onProgress Optional callback invoked as the upload, processing, and
 *                   download phases advance.
 * @throws Error with the API's error detail when the request fails.
 */
export async function compressPdfs(
  files: File[],
  quality: CompressionQuality,
  onProgress?: (progress: CompressionProgress) => void,
): Promise<CompressionResult> {
  const form = new FormData()
  for (const file of files) {
    form.append("files", file)
  }
  form.append("quality", quality)

  try {
    const response = await axios.post<Blob>(`${API_BASE_URL}/pdf/compress`, form, {
      responseType: "blob",
      onUploadProgress: (event) => {
        if (!onProgress) return
        const percent = toPercent(event)
        // Once the bytes are all sent, the server is busy compressing.
        if (percent !== null && percent >= 100) {
          onProgress({ phase: "processing", percent: null })
        } else {
          onProgress({ phase: "uploading", percent })
        }
      },
      onDownloadProgress: (event) => {
        onProgress?.({ phase: "downloading", percent: toPercent(event) })
      },
    })

    const blob = response.data
    const fallback = files.length === 1 ? files[0].name : "compressed-pdfs.zip"

    return {
      blob,
      filename: parseFilename(response.headers["content-disposition"], fallback),
      originalSize: Number(response.headers["x-original-size"] ?? 0),
      compressedSize: Number(response.headers["x-compressed-size"] ?? blob.size),
    }
  } catch (err) {
    // FastAPI returns errors as { detail: string }. With responseType "blob",
    // the error body is a Blob we must read back to text to extract the detail.
    if (axios.isAxiosError(err) && err.response) {
      let detail = `Request failed with status ${err.response.status}`
      try {
        const data = err.response.data
        const text = data instanceof Blob ? await data.text() : JSON.stringify(data)
        const parsed = JSON.parse(text)
        if (typeof parsed?.detail === "string") detail = parsed.detail
      } catch {
        // Non-JSON error body; keep the default message.
      }
      throw new Error(detail)
    }
    throw err instanceof Error ? err : new Error("Something went wrong.")
  }
}

/** Result of a successful unlock request. */
export interface UnlockResult {
  /** The unlocked PDF. */
  blob: Blob
  /** Suggested download filename parsed from the response. */
  filename: string
}

/**
 * Remove the password from a single PDF and return the unlocked file.
 *
 * Reuses the same upload/processing/download progress phases as compression.
 *
 * @throws Error with the API's error detail (e.g. wrong password) on failure.
 */
export async function unlockPdf(
  file: File,
  password: string,
  onProgress?: (progress: CompressionProgress) => void,
): Promise<UnlockResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("password", password)

  try {
    const response = await axios.post<Blob>(`${API_BASE_URL}/pdf/unlock`, form, {
      responseType: "blob",
      onUploadProgress: (event) => {
        if (!onProgress) return
        const percent = toPercent(event)
        // Once the bytes are all sent, the server is busy decrypting.
        if (percent !== null && percent >= 100) {
          onProgress({ phase: "processing", percent: null })
        } else {
          onProgress({ phase: "uploading", percent })
        }
      },
      onDownloadProgress: (event) => {
        onProgress?.({ phase: "downloading", percent: toPercent(event) })
      },
    })

    const blob = response.data
    return {
      blob,
      filename: parseFilename(response.headers["content-disposition"], `unlocked-${file.name}`),
    }
  } catch (err) {
    // FastAPI returns errors as { detail: string }. With responseType "blob",
    // the error body is a Blob we must read back to text to extract the detail.
    if (axios.isAxiosError(err) && err.response) {
      let detail = `Request failed with status ${err.response.status}`
      try {
        const data = err.response.data
        const text = data instanceof Blob ? await data.text() : JSON.stringify(data)
        const parsed = JSON.parse(text)
        if (typeof parsed?.detail === "string") detail = parsed.detail
      } catch {
        // Non-JSON error body; keep the default message.
      }
      throw new Error(detail)
    }
    throw err instanceof Error ? err : new Error("Something went wrong.")
  }
}

/** Encryption strengths exposed by the lock endpoint. */
export const ENCRYPTION_LEVELS = ["aes-256", "aes-128"] as const

export type EncryptionLevel = (typeof ENCRYPTION_LEVELS)[number]

/** Options for locking a PDF; permissions default to a sensible "view only". */
export interface LockOptions {
  password: string
  allowPrinting: boolean
  allowCopying: boolean
  allowEditing: boolean
  encryption: EncryptionLevel
}

/** Result of a successful lock request. */
export interface LockResult {
  /** The password-protected PDF. */
  blob: Blob
  /** Suggested download filename parsed from the response. */
  filename: string
}

/**
 * Add a password to a single PDF and return the protected file.
 *
 * Reuses the same upload/processing/download progress phases as the other tools.
 *
 * @throws Error with the API's error detail (e.g. already protected) on failure.
 */
export async function lockPdf(
  file: File,
  options: LockOptions,
  onProgress?: (progress: CompressionProgress) => void,
): Promise<LockResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("password", options.password)
  form.append("allow_printing", String(options.allowPrinting))
  form.append("allow_copying", String(options.allowCopying))
  form.append("allow_editing", String(options.allowEditing))
  form.append("encryption", options.encryption)

  try {
    const response = await axios.post<Blob>(`${API_BASE_URL}/pdf/lock`, form, {
      responseType: "blob",
      onUploadProgress: (event) => {
        if (!onProgress) return
        const percent = toPercent(event)
        // Once the bytes are all sent, the server is busy encrypting.
        if (percent !== null && percent >= 100) {
          onProgress({ phase: "processing", percent: null })
        } else {
          onProgress({ phase: "uploading", percent })
        }
      },
      onDownloadProgress: (event) => {
        onProgress?.({ phase: "downloading", percent: toPercent(event) })
      },
    })

    const blob = response.data
    return {
      blob,
      filename: parseFilename(response.headers["content-disposition"], `locked-${file.name}`),
    }
  } catch (err) {
    // FastAPI returns errors as { detail: string }. With responseType "blob",
    // the error body is a Blob we must read back to text to extract the detail.
    if (axios.isAxiosError(err) && err.response) {
      let detail = `Request failed with status ${err.response.status}`
      try {
        const data = err.response.data
        const text = data instanceof Blob ? await data.text() : JSON.stringify(data)
        const parsed = JSON.parse(text)
        if (typeof parsed?.detail === "string") detail = parsed.detail
      } catch {
        // Non-JSON error body; keep the default message.
      }
      throw new Error(detail)
    }
    throw err instanceof Error ? err : new Error("Something went wrong.")
  }
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Format a byte count as a human-readable string (e.g. "1.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
