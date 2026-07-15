import { unzipSync, zipSync } from "fflate"

/**
 * Unzip `blob`, rename entries in sorted original order to `names`, re-zip.
 * `names.length` must equal the number of files in the archive.
 */
export async function renameZipEntries(blob: Blob, names: string[]): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const entries = unzipSync(bytes)
  const keys = Object.keys(entries).sort()
  if (keys.length !== names.length) {
    throw new Error("File count does not match the rename list.")
  }
  const next: Record<string, Uint8Array> = {}
  keys.forEach((key, index) => {
    next[names[index]!] = entries[key]!
  })
  const out = zipSync(next)
  // Copy into a fresh ArrayBuffer so Blob gets a real ArrayBuffer, not ArrayBufferLike.
  const copy = new Uint8Array(out.byteLength)
  copy.set(out)
  return new Blob([copy.buffer], { type: "application/zip" })
}
