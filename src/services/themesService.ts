import { query } from '../db/db'
import type { ProposedTheme, FindingRow } from '../types'

const THEME_KEYWORDS: Record<string, string[]> = {
  'Indigenization': ['indigenous', 'decoloniz', 'reconciliation', 'first nation', 'métis', 'inuit', 'treaty', 'indigenous student'],
  'Digital Transformation': ['digital', 'technology', 'it transformation', 'system moderniz', 'erp', 'cloud', 'data analytics', 'cyber', 'platform'],
  'Financial Sustainability': ['financial sustainab', 'deficit', 'revenue diversif', 'cost reduction', 'budget pressure', 'endowment', 'financial health'],
  'Research Excellence': ['research', 'grant', 'innovation', 'discovery', 'tri-council', 'nserc', 'sshrc', 'cihr', 'research excellence'],
  'Student Success': ['student success', 'retention', 'graduation rate', 'student support', 'student experience', 'mental health', 'accessibility'],
  'Sustainability & Climate': ['sustainab', 'climate', 'ghg', 'net zero', 'carbon', 'renewable energy', 'emissions', 'environmental'],
  'Enrolment Management': ['enrolment', 'enrollment', 'domestic student', 'student recruitment', 'enrolment decline', 'demographic'],
  'Internationalization': ['international student', 'global partnership', 'internationalization', 'study abroad', 'international revenue'],
  'People & Culture': ['faculty', 'staff', 'talent', 'workforce', 'culture', 'equity, diversity', 'edi ', 'dei ', 'people strategy'],
}

export function proposeThemes(_institutionId: number, findings: FindingRow[]): ProposedTheme[] {
  const themes = query<{ id: number; name: string }>(
    `SELECT id, name FROM themes WHERE is_system = 1 ORDER BY name`
  )

  const findingText = findings.map((f) => `${f.title} ${f.narrative}`).join('\n').toLowerCase()
  const proposed: ProposedTheme[] = []

  for (const theme of themes) {
    const keywords = THEME_KEYWORDS[theme.name] ?? []
    const matches: string[] = []

    for (const kw of keywords) {
      const idx = findingText.indexOf(kw)
      if (idx !== -1) {
        const start = Math.max(0, idx - 40)
        const end = Math.min(findingText.length, idx + kw.length + 60)
        matches.push('...' + findingText.slice(start, end).replace(/\n/g, ' ') + '...')
      }
    }

    if (matches.length > 0) {
      const score = Math.min(5, Math.max(1, matches.length))
      proposed.push({
        themeId: theme.id,
        themeName: theme.name,
        evidence: matches[0],
        relevanceScore: score,
      })
    }
  }

  return proposed.sort((a, b) => b.relevanceScore - a.relevanceScore)
}
