import { getChunks, updateDocumentStatus, updateDocumentClassification } from '../db/documentDb'
import { saveDb } from '../db/db'
import {
  classifyDocument,
  extractFinancials,
  extractStrategicPriorities,
  extractSustainability,
  extractKeyFacts,
} from './aiService'
import {
  saveFinancials,
  saveStrategicPlan,
  saveSustainability,
  saveKeyFacts,
} from '../db/extractionDb'
import type { ClassificationResult } from '../types'
import type { ProcessingStep } from '../context/ProcessingContext'

export async function runProcessingPipeline(
  documentId: number,
  institutionId: number,
  onStepChange: (step: ProcessingStep) => void,
  onClassified: (result: ClassificationResult) => Promise<ClassificationResult | null>
): Promise<void> {
  try {
    const chunks = getChunks(documentId)

    onStepChange('classifying')
    const classificationResult = await classifyDocument(chunks)

    onStepChange('awaiting_confirmation')
    const confirmed = await onClassified(classificationResult)
    if (!confirmed) throw new Error('Cancelled')

    updateDocumentClassification(
      documentId,
      confirmed.documentType,
      confirmed.fiscalYear ?? undefined
    )

    onStepChange('extracting_data')

    if (
      confirmed.documentType === 'Financial Statement' ||
      confirmed.documentType === 'Annual Report'
    ) {
      const financials = await extractFinancials(chunks)
      saveFinancials(institutionId, documentId, financials)
    }

    if (
      confirmed.documentType === 'Strategic Plan' ||
      confirmed.documentType === 'Annual Report'
    ) {
      const strategic = await extractStrategicPriorities(chunks)
      saveStrategicPlan(institutionId, documentId, strategic)
    }

    if (
      confirmed.documentType === 'Sustainability Report' ||
      confirmed.documentType === 'Annual Report'
    ) {
      const sustainability = await extractSustainability(chunks)
      saveSustainability(institutionId, documentId, sustainability)
    }

    if (confirmed.documentType === 'Other') {
      const keyFacts = await extractKeyFacts(chunks)
      saveKeyFacts(institutionId, documentId, keyFacts.facts)
    }

    onStepChange('writing_db')
    saveDb()

    updateDocumentStatus(documentId, 'processed')
    onStepChange('complete')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    updateDocumentStatus(documentId, 'failed', message)
    onStepChange('failed')
    throw err
  }
}
