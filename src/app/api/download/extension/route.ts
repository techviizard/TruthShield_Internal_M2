import { NextResponse } from 'next/server'
// archiver v8 ships named exports only (no default), and its bundled .d.ts still
// declares the v7 surface — `ZipArchive` exists at runtime but is not typed.
// Narrow the cast to exactly the constructor being used rather than `any`.
import * as archiverPkg from 'archiver'
import type { Archiver } from 'archiver'

const { ZipArchive } = archiverPkg as unknown as {
  ZipArchive: new (options?: { zlib?: { level?: number } }) => Archiver
}
import { readdir, stat, readFile } from 'fs/promises'
import path from 'path'
import { appConfig } from '@/config/app.config'

/**
 * Packages the MV3 extension in `extension/` as a zip the operator can load via
 * chrome://extensions → Load unpacked (after unzipping), or upload to a store.
 *
 * Built from the working tree at request time rather than from a checked-in
 * artifact, so the download can never drift from the source in this repo.
 */
const EXTENSION_DIR = path.join(process.cwd(), 'extension')

async function collect(dir: string, base = ''): Promise<{ abs: string; rel: string }[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: { abs: string; rel: string }[] = []
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...await collect(abs, rel))
    else files.push({ abs, rel })
  }
  return files
}

export async function GET() {
  try {
    const dirStat = await stat(EXTENSION_DIR).catch(() => null)
    if (!dirStat?.isDirectory()) {
      return NextResponse.json(
        { error: 'Extension source directory is not present in this deployment.' },
        { status: 404 }
      )
    }

    const files = await collect(EXTENSION_DIR)
    const archive = new ZipArchive({ zlib: { level: 9 } })
    const chunks: Buffer[] = []
    archive.on('data', (c: Buffer) => chunks.push(c))

    const done = new Promise<void>((resolve, reject) => {
      archive.on('end', resolve)
      archive.on('error', reject)
    })

    for (const f of files) {
      archive.append(await readFile(f.abs), { name: f.rel })
    }
    await archive.finalize()
    await done

    const zip = Buffer.concat(chunks)
    const filename = `truthshield-extension-v${appConfig.app.version}.zip`

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zip.length),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to package the extension' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
