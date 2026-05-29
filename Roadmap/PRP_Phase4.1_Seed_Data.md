# PRP — Phase 4.1: Seed Data for UI Preview

## Context

Phases 1–4 are complete. All data views exist (charts, tables, strategic priorities, KPIs, sustainability) but the database is empty for any new user. This phase adds a "Load Sample Data" button in Settings that inserts realistic (but fictional) data for two Canadian universities, allowing anyone to immediately preview all views without needing real PDFs or an Azure OpenAI key.

---

## Implementation

### File: `src/db/seedData.ts`

Export a single function:

```ts
export function seedDatabase(): void
```

Guard: query `SELECT COUNT(*) as c FROM institutions WHERE short_code IN ('UBC', 'UOFT')` — if `c > 0`, throw `new Error('Seed data already loaded')`.

Insert in this order (capture IDs with `SELECT last_insert_rowid() as id` after each INSERT that is referenced by a foreign key):

1. Tags
2. Institutions
3. institution_tags
4. Documents
5. financial_summaries
6. strategic_plans → strategic_priorities
7. sustainability_metrics
8. kpi_datapoints

Call `saveDb()` once at the end.

---

## Seed Data

### Tags

| name | colour |
|---|---|
| Research-Intensive | #16a34a |
| G13 | #2563eb |

### Institutions

**UBC**
- name: `University of British Columbia`
- short_code: `UBC`
- province: `BC`
- institution_type: `University`
- website: `https://www.ubc.ca`
- notes: `Sample data — fictional figures`
- tags: Research-Intensive

**UToronto**
- name: `University of Toronto`
- short_code: `UOFT`
- province: `ON`
- institution_type: `University`
- website: `https://www.utoronto.ca`
- notes: `Sample data — fictional figures`
- tags: Research-Intensive, G13

### Documents

| institution | filename | document_type | fiscal_year | processing_status | page_count | word_count |
|---|---|---|---|---|---|---|
| UBC | UBC_Annual_Report_2023.pdf | Annual Report | 2023 | processed | 142 | 58300 |
| UBC | UBC_Financial_Statements_2022.pdf | Financial Statement | 2022 | processed | 48 | 19200 |
| UToronto | UToronto_Annual_Report_2023.pdf | Annual Report | 2023 | processed | 168 | 71500 |

### Financial Summaries (all CAD)

**UBC 2022**
- total_revenue: 3_420_000_000
- total_expenses: 3_290_000_000
- net_surplus_deficit: 130_000_000
- operating_revenue: 2_980_000_000
- operating_expenses: 2_870_000_000
- government_grants: 890_000_000
- tuition_revenue: 1_020_000_000
- research_revenue: 680_000_000
- investment_income: 142_000_000
- total_assets: 8_200_000_000
- total_liabilities: 2_900_000_000
- net_assets: 5_300_000_000
- endowment_value: 2_100_000_000
- international_student_revenue: 420_000_000

**UBC 2023**
- total_revenue: 3_610_000_000
- total_expenses: 3_450_000_000
- net_surplus_deficit: 160_000_000
- operating_revenue: 3_140_000_000
- operating_expenses: 3_010_000_000
- government_grants: 920_000_000
- tuition_revenue: 1_090_000_000
- research_revenue: 730_000_000
- investment_income: 168_000_000
- total_assets: 8_650_000_000
- total_liabilities: 2_980_000_000
- net_assets: 5_670_000_000
- endowment_value: 2_310_000_000
- international_student_revenue: 455_000_000

**UToronto 2023**
- total_revenue: 4_820_000_000
- total_expenses: 4_590_000_000
- net_surplus_deficit: 230_000_000
- operating_revenue: 4_210_000_000
- operating_expenses: 4_020_000_000
- government_grants: 1_140_000_000
- tuition_revenue: 1_580_000_000
- research_revenue: 1_240_000_000
- investment_income: 215_000_000
- total_assets: 11_400_000_000
- total_liabilities: 3_800_000_000
- net_assets: 7_600_000_000
- endowment_value: 3_050_000_000
- international_student_revenue: 610_000_000

### Strategic Plans + Priorities

**UBC — "Shaping UBC's Next Century 2021–2026"**
- plan_period_start: 2021, plan_period_end: 2026
- vision_statement: "To be one of the world's great universities — advancing a better world through excellence in research, learning, and community engagement."

| priority_name | pillar | progress_status | description | key_initiatives |
|---|---|---|---|---|
| Advancing Research Excellence | Excellence | On Track | Strengthen UBC's position as a top-10 global research university through increased funding, talent recruitment, and cross-disciplinary collaboration. | ["Recruit 50 Canada Research Chairs by 2025", "Establish 3 new interdisciplinary research institutes", "Double industry partnership revenue"] |
| Transforming Learning Experiences | Excellence | On Track | Reimagine undergraduate and graduate education through experiential learning, flexible pathways, and integration of Indigenous knowledge. | ["Launch UBC Online credential programs in 5 new disciplines", "Expand co-op placements by 30%", "Integrate Indigenous perspectives into all core curricula"] |
| Fostering Indigenous Flourishing | Inclusion | On Track | Advance Indigenous peoples' self-determination, support Indigenous student success, and implement the Truth and Reconciliation Commission calls to action. | ["Increase Indigenous student enrolment by 40%", "Hire 20 Indigenous faculty members", "Complete Reconciliation Framework implementation"] |
| Building an Inclusive Community | Inclusion | At Risk | Create a campus culture where every student, faculty, and staff member experiences genuine belonging, equity, and respect. | ["Implement anti-racism action plan", "Achieve pay equity across all staff classifications", "Expand mental health services by 50%"] |
| Accelerating Climate Action | Excellence | On Track | Achieve carbon neutrality by 2035 and embed sustainability across all UBC operations and academic programs. | ["Transition campus fleet to zero-emission vehicles by 2027", "Retrofit 10 legacy buildings to net-zero standard", "Launch Climate Emergency Fund"] |

**UToronto — "Towards 2030: A Strategic Vision"**
- plan_period_start: 2023, plan_period_end: 2030
- vision_statement: "To be a globally pre-eminent university, driving innovation and discovery for the benefit of humanity."

| priority_name | pillar | progress_status | description | key_initiatives |
|---|---|---|---|---|
| Research Impact at Scale | Research | On Track | Position U of T as the leading research university in North America, with breakthrough contributions across health, AI, sustainability, and social innovation. | ["Grow annual research revenue to $2B by 2030", "Launch U of T AI Institute", "Establish 5 new Canada Excellence Research Chairs"] |
| Student Success and Wellbeing | People | On Track | Ensure every student — undergraduate and graduate — has access to the support, mentorship, and resources needed to thrive academically and personally. | ["Double mental health counsellor capacity", "Introduce guaranteed financial aid for low-income undergraduates", "Expand co-curricular transcript program"] |
| Equity, Diversity, and Inclusion | People | At Risk | Build a fully inclusive university where all community members experience equitable access to opportunities and are valued for their contributions. | ["Achieve gender parity in senior leadership by 2026", "Increase Black and Indigenous faculty representation by 60%", "Implement universal design standards in all new buildings"] |

### KPI Datapoints

**UBC** (fiscal_year: 2023)

| kpi_name | kpi_category | value | unit | notes |
|---|---|---|---|---|
| Total Student Enrolment | Enrolment | 68420 | students | FTE, all programs |
| International Student Enrolment | Enrolment | 18960 | students | ~28% of total |
| Indigenous Student Enrolment | Indigenous | 1840 | students | Self-identified |
| Annual Research Revenue | Research | 730000000 | CAD | Includes tri-council and industry |
| Research Publications | Research | 9200 | publications | Peer-reviewed, calendar year |
| 6-Year Graduation Rate | Student Success | 84.2 | % | Undergraduate cohort |
| Student Satisfaction Score | Student Success | 78 | % | Annual survey |
| Operating Cost per Student | Financial | 50400 | CAD | Full-time equivalent |

**UToronto** (fiscal_year: 2023)

| kpi_name | kpi_category | value | unit | notes |
|---|---|---|---|---|
| Total Student Enrolment | Enrolment | 97020 | students | FTE, all programs |
| International Student Enrolment | Enrolment | 28500 | students | ~29% of total |
| Indigenous Student Enrolment | Indigenous | 2200 | students | Self-identified |
| Annual Research Revenue | Research | 1240000000 | CAD | Largest in Canada |
| Research Publications | Research | 17400 | publications | Peer-reviewed, calendar year |
| 6-Year Graduation Rate | Student Success | 87.5 | % | Undergraduate cohort |
| Industry Partnership Agreements | Research | 412 | agreements | Active in fiscal year |
| Operating Cost per Student | Financial | 49700 | CAD | Full-time equivalent |

### Sustainability Metrics

**UBC 2022**
- ghg_emissions_total: 78400 (tCO₂e)
- ghg_scope_1: 28100
- ghg_scope_2: 19600
- ghg_scope_3: 30700
- energy_consumption: 1_240_000 (GJ)
- renewable_energy_pct: 38
- waste_diversion_rate: 64
- water_consumption: 3_800_000 (m³)
- net_zero_target_year: 2035
- sustainability_certifications: ["LEED Gold", "ISO 14001"]

**UBC 2023**
- ghg_emissions_total: 74200
- ghg_scope_1: 26400
- ghg_scope_2: 18100
- ghg_scope_3: 29700
- energy_consumption: 1_190_000
- renewable_energy_pct: 42
- waste_diversion_rate: 67
- water_consumption: 3_620_000
- net_zero_target_year: 2035
- sustainability_certifications: ["LEED Gold", "ISO 14001"]

**UToronto 2023**
- ghg_emissions_total: 112600
- ghg_scope_1: 41800
- ghg_scope_2: 28400
- ghg_scope_3: 42400
- energy_consumption: 1_820_000
- renewable_energy_pct: 29
- waste_diversion_rate: 58
- water_consumption: 5_100_000
- net_zero_target_year: 2050
- sustainability_certifications: ["STARS Gold"]

---

## Settings UI

Add a **Developer Tools** section in `src/pages/Settings.tsx` (below Database Management):
- "Load Sample Data" button
- `ConfirmDialog` with message: "This will add 2 sample institutions with documents, financials, and strategic data. Your existing data will not be affected."
- On success: refresh context + success toast
- On error (already seeded): error toast

---

## Deliverable

After Phase 4.1:
1. Settings → Developer Tools → Load Sample Data works
2. All Phase 4 tabs show populated data for UBC and UToronto
3. UBC Financials tab shows a 2-year trend chart
4. UBC Sustainability tab shows a 2-year GHG trend
5. Strategic priorities are grouped by pillar with status badges
6. Loading twice shows a graceful error toast
