import type { ParsedFinding } from '../types'

const SERVICE_LINE_KEYWORDS: Record<string, string[]> = {
  'Technology Advisory': ['technology', 'digital', 'system', 'it ', 'data', 'cyber', 'cloud', 'erp', 'software', 'platform', 'infrastructure'],
  'Financial Advisory': ['financial', 'finance', 'revenue', 'cost', 'budget', 'endowment', 'deficit', 'surplus', 'funding', 'investment'],
  'Strategy': ['strategy', 'strategic', 'growth', 'positioning', 'competitive', 'market', 'enrolment', 'enrollment', 'partnership'],
  'People & Change': ['people', 'talent', 'workforce', 'culture', 'change', 'hr ', 'human resource', 'faculty', 'staff', 'leadership'],
  'Risk Advisory': ['risk', 'compliance', 'governance', 'regulatory', 'audit', 'control', 'security'],
}

function detectServiceLine(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [line, keywords] of Object.entries(SERVICE_LINE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return line
  }
  return null
}

export function parseInsightsMarkdown(markdown: string): ParsedFinding[] {
  const findings: ParsedFinding[] = []

  const sections = markdown.split(/^## /m).filter(Boolean)

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const heading = lines[0].trim().toLowerCase()
    const body = lines.slice(1).join('\n').trim()

    if (heading.includes('consulting opportunit')) {
      // Numbered items
      const items = body.split(/\n(?=\d+\.)/).filter(Boolean)
      items.forEach((item, idx) => {
        const text = item.replace(/^\d+\.\s*/, '').trim()
        if (!text) return
        const titleMatch = text.match(/^([^.:\n]{5,80})[.:\n]/)
        const title = titleMatch ? titleMatch[1].trim() : text.slice(0, 60)
        findings.push({
          finding_type: 'ConsultingOpportunity',
          title,
          narrative: text,
          priority_rank: idx + 1,
          relevant_service_line: detectServiceLine(text),
        })
      })
    } else if (heading.includes('risk') || heading.includes('challenge')) {
      const items = body.split(/\n[-*•]/).filter(Boolean)
      items.forEach((item) => {
        const text = item.trim()
        if (!text) return
        const titleMatch = text.match(/^([^.:\n]{5,80})[.:\n]/)
        const title = titleMatch ? titleMatch[1].trim() : text.slice(0, 60)
        findings.push({
          finding_type: 'Risk',
          title,
          narrative: text,
          priority_rank: null,
          relevant_service_line: detectServiceLine(text),
        })
      })
    } else if (heading.includes('financial health')) {
      const deficitKeywords = ['deficit', 'declining', 'concern', 'pressure', 'risk', 'constrain', 'challenge']
      const isWeakness = deficitKeywords.some((kw) => body.toLowerCase().includes(kw))
      findings.push({
        finding_type: isWeakness ? 'Weakness' : 'Strength',
        title: 'Financial Health Summary',
        narrative: body,
        priority_rank: null,
        relevant_service_line: 'Financial Advisory',
      })
    } else if (heading.includes('strategic') || heading.includes('theme')) {
      const items = body.split(/\n[-*•]/).filter(Boolean)
      items.forEach((item) => {
        const text = item.trim()
        if (!text) return
        const titleMatch = text.match(/^([^.:\n]{3,60})[.:\n]/)
        const title = titleMatch ? titleMatch[1].trim() : text.slice(0, 50)
        findings.push({
          finding_type: 'Trend',
          title,
          narrative: text,
          priority_rank: null,
          relevant_service_line: detectServiceLine(text),
        })
      })
    }
  }

  if (findings.length === 0) {
    findings.push({
      finding_type: 'Trend',
      title: 'Analysis Summary',
      narrative: markdown,
      priority_rank: null,
      relevant_service_line: null,
    })
  }

  return findings
}
