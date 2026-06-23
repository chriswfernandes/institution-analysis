import { getSetting } from '../db/db'

export interface ChunkInput {
  chunk_index: number
  chunk_text: string
  token_estimate: number
}

export interface ConversionResult {
  markdown: string
  wordCount: number
  chunks: ChunkInput[]
}

const CHUNK_SIZE = 12000
const CHUNK_OVERLAP = 200
const CONVERSION_TIMEOUT_MS = 300000

function getDoclingEndpoint(): string {
  const endpoint = getSetting('docling_endpoint')
  if (!endpoint) {
    throw new Error('Please configure the Docling endpoint in Settings before uploading documents.')
  }
  return endpoint.replace(/\/$/, '')
}

export async function convertToMarkdown(file: File): Promise<ConversionResult> {
  const endpoint = getDoclingEndpoint()
  const form = new FormData()
  form.append('files', file, file.name)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONVERSION_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(`${endpoint}/v1/convert/file`, { method: 'POST', body: form, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Docling conversion timed out for ${file.name}. Try a smaller file or enable Docling's async endpoint.`)
    }
    throw new Error(`Could not reach Docling at ${endpoint}. Is Docling Serve running and reachable?`)
  } finally {
    clearTimeout(timer)
  }
  if (!resp.ok) {
    throw new Error(`Docling conversion failed: ${resp.status} ${resp.statusText}`)
  }

  const data = (await resp.json()) as { document?: { md_content?: string } }
  const markdown = data.document?.md_content ?? ''
  if (!markdown.trim()) {
    throw new Error('Docling returned no markdown content for this file.')
  }

  const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length
  return { markdown, wordCount, chunks: chunkText(markdown) }
}

// Markdown is just text, so the same chunking strategy applies.
export function chunkText(text: string): ChunkInput[] {
  const chunks: ChunkInput[] = []
  let start = 0
  let index = 0

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    const content = text.slice(start, end)
    chunks.push({
      chunk_index: index,
      chunk_text: content,
      token_estimate: Math.ceil(content.length / 4),
    })
    if (end === text.length) break
    start = end - CHUNK_OVERLAP
    index++
  }

  return chunks
}

export async function testDoclingConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const endpoint = getDoclingEndpoint()
    const resp = await fetch(`${endpoint}/health`).catch(() => null)
    if (resp && resp.ok) return { success: true, message: 'Docling is reachable' }
    // Fall back to a tiny conversion if /health is not exposed
    const probe = new File(['# ping'], 'ping.md', { type: 'text/markdown' })
    await convertToMarkdown(probe)
    return { success: true, message: 'Docling is reachable' }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) }
  }
}
