import * as pdfjsLib from 'pdfjs-dist'

export interface ChunkInput {
  chunk_index: number
  chunk_text: string
  token_estimate: number
}

export interface PdfExtractResult {
  text: string
  pageCount: number
  wordCount: number
  chunks: ChunkInput[]
}

const CHUNK_SIZE = 12000
const CHUNK_OVERLAP = 200

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageCount = pdf.numPages

  const pageTexts: string[] = []
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(pageText)
  }

  const text = pageTexts.join('\n')
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const chunks = chunkText(text)

  return { text, pageCount, wordCount, chunks }
}

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
