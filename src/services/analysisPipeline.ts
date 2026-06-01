import { createAnalysisRun, updateAnalysisRunStatus, saveFindings, getFindingsByRun } from '../db/analysisDb'
import { compileInstitutionData } from './insightsCompiler'
import { generateInsights } from './aiService'
import { parseInsightsMarkdown } from './insightsParser'
import { proposeThemes } from './themesService'
import type { FindingRow, ProposedTheme } from '../types'

export interface AnalysisResult {
  runId: number
  findings: FindingRow[]
  proposedThemes: ProposedTheme[]
}

export async function runFullAnalysis(
  institutionId: number,
  institutionName: string,
  onStatus: (msg: string) => void
): Promise<AnalysisResult> {
  onStatus('Compiling institution data…')
  const compiledData = compileInstitutionData(institutionId)

  const runId = createAnalysisRun(institutionId, 'FullAnalysis')

  try {
    onStatus('Sending to AI for analysis…')
    const markdown = await generateInsights(institutionName, compiledData)

    onStatus('Parsing findings…')
    const parsed = parseInsightsMarkdown(markdown)

    saveFindings(runId, institutionId, parsed)
    updateAnalysisRunStatus(runId, 'Complete', new Date().toISOString())

    const findings = getFindingsByRun(runId)
    const proposedThemes = proposeThemes(institutionId, findings)

    onStatus('Analysis complete.')
    return { runId, findings, proposedThemes }
  } catch (err) {
    updateAnalysisRunStatus(runId, 'Failed', new Date().toISOString())
    throw err
  }
}

export async function runQuickInsights(
  _documentId: number,
  institutionId: number,
  institutionName: string,
  onStatus: (msg: string) => void
): Promise<AnalysisResult> {
  onStatus('Compiling document data…')
  const compiledData = compileInstitutionData(institutionId)

  const runId = createAnalysisRun(institutionId, 'QuickInsights', [_documentId])

  try {
    onStatus('Sending to AI…')
    const markdown = await generateInsights(institutionName, compiledData)

    onStatus('Parsing findings…')
    const parsed = parseInsightsMarkdown(markdown)

    saveFindings(runId, institutionId, parsed)
    updateAnalysisRunStatus(runId, 'Complete', new Date().toISOString())

    const findings = getFindingsByRun(runId)
    const proposedThemes = proposeThemes(institutionId, findings)

    onStatus('Done.')
    return { runId, findings, proposedThemes }
  } catch (err) {
    updateAnalysisRunStatus(runId, 'Failed', new Date().toISOString())
    throw err
  }
}
