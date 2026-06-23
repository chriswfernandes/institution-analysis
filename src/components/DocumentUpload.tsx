import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { convertToMarkdown } from '../services/doclingService'
import { createDocument, saveChunks, updateDocumentStatus } from '../db/documentDb'
import { getAllDocuments } from '../db/documentDb'
import { useAppState, useAppDispatch } from '../context/AppContext'
import { useProcessing } from '../context/ProcessingContext'
import { useToast } from './useToast'
import { ClassificationConfirmModal } from './ClassificationConfirmModal'
import { runProcessingPipeline } from '../services/processingPipeline'
import type { ClassificationResult } from '../types'

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp',
]

function isAccepted(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

interface Props {
  institutionId?: number
  onUploaded?: () => void
}

interface PendingConfirm {
  result: ClassificationResult
  filename: string
  resolve: (confirmed: ClassificationResult | null) => void
}

export function DocumentUpload({ institutionId, onUploaded }: Props) {
  const { institutions } = useAppState()
  const dispatch = useAppDispatch()
  const { addJob, updateJob, removeJob } = useProcessing()
  const showToast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<number | ''>(
    institutionId ?? ''
  )
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)

  const waitForConfirmation = useCallback(
    (result: ClassificationResult, filename: string): Promise<ClassificationResult | null> =>
      new Promise((resolve) => setPendingConfirm({ result, filename, resolve })),
    []
  )

  async function processFiles(files: File[]) {
    const acceptedFiles = files.filter(isAccepted)
    if (acceptedFiles.length === 0) {
      showToast('error', 'Unsupported file type')
      return
    }

    const instId = institutionId ?? (selectedInstitutionId as number)
    if (!instId) {
      showToast('error', 'Please select an institution first')
      return
    }

    for (const file of acceptedFiles) {
      const jobId = `${Date.now()}-${file.name}`
      addJob({ id: jobId, fileName: file.name, step: 'reading', progress: 0 })
      let docId: number | null = null

      try {
        updateJob({ id: jobId, step: 'converting', progress: 25 })
        const { markdown, wordCount, chunks } = await convertToMarkdown(file)

        updateJob({ id: jobId, step: 'chunking', progress: 50 })
        docId = createDocument({
          institution_id: instId,
          filename: file.name,
          page_count: 0,
          word_count: wordCount,
          raw_text: markdown,
        })

        updateJob({ id: jobId, step: 'saving', progress: 75 })
        saveChunks(docId, chunks)

        // Trigger AI pipeline
        await runProcessingPipeline(
          docId,
          instId,
          (step) => updateJob({ id: jobId, step }),
          (classificationResult) => waitForConfirmation(classificationResult, file.name)
        )

        dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
        removeJob(jobId)
        showToast('success', `${file.name} processed successfully`)
        onUploaded?.()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (docId !== null && !msg.includes('Cancelled')) {
          updateDocumentStatus(docId, 'failed', msg)
        }
        dispatch({ type: 'SET_DOCUMENTS', payload: getAllDocuments() })
        removeJob(jobId)
        if (!msg.includes('Cancelled')) {
          showToast('error', `Failed to process ${file.name}: ${msg}`)
        }
      }
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function handleConfirm(confirmed: ClassificationResult) {
    if (pendingConfirm) {
      setPendingConfirm(null)
      pendingConfirm.resolve(confirmed)
    }
  }

  function handleCancelConfirm() {
    if (pendingConfirm) {
      pendingConfirm.resolve(null)
      setPendingConfirm(null)
    }
  }

  return (
    <>
      <div className="space-y-3">
        {!institutionId && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Institution</label>
            <select
              className="input"
              value={selectedInstitutionId}
              onChange={(e) => setSelectedInstitutionId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select institution…</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-green-500 bg-green-50'
              : 'border-slate-300 hover:border-green-400 hover:bg-slate-50'
          }`}
        >
          <UploadCloud size={32} className="mx-auto text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-700">Drop documents here or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">PDF, Word, PowerPoint, Excel, HTML, and images · Multiple files supported</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            multiple
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      </div>

      {pendingConfirm && (
        <ClassificationConfirmModal
          open
          result={pendingConfirm.result}
          filename={pendingConfirm.filename}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  )
}
