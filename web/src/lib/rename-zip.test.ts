import { describe, expect, it } from "vitest"
import { zipSync, unzipSync, strToU8 } from "fflate"
import { renameZipEntries } from "./rename-zip"

describe("renameZipEntries", () => {
  it("rewrites entry names in order", async () => {
    const zipped = zipSync({
      "old-1.pdf": strToU8("%PDF-1"),
      "old-2.pdf": strToU8("%PDF-2"),
    })
    const blob = new Blob([zipped], { type: "application/zip" })
    const out = await renameZipEntries(blob, ["alpha.pdf", "beta.pdf"])
    const entries = unzipSync(new Uint8Array(await out.arrayBuffer()))
    expect(Object.keys(entries).sort()).toEqual(["alpha.pdf", "beta.pdf"])
    expect(new TextDecoder().decode(entries["alpha.pdf"])).toBe("%PDF-1")
  })
})
