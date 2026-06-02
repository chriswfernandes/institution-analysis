import { execute, query, saveDb } from './db'

function lastId(): number {
  const [row] = query<{ id: number }>('SELECT last_insert_rowid() as id')
  return row.id
}

export function seedDatabase(): void {
  const [existing] = query<{ c: number }>(
    "SELECT COUNT(*) as c FROM institutions WHERE short_code IN ('UBC', 'UOFT')"
  )
  if ((existing?.c ?? 0) > 0) throw new Error('Seed data already loaded')

  // ── Tags ──────────────────────────────────────────────────────────────────
  execute("INSERT OR IGNORE INTO tags (name, colour) VALUES (?, ?)", ['Research-Intensive', '#16a34a'])
  const [tagRI] = query<{ id: number }>('SELECT id FROM tags WHERE name = ?', ['Research-Intensive'])

  execute("INSERT OR IGNORE INTO tags (name, colour) VALUES (?, ?)", ['G13', '#2563eb'])
  const [tagG13] = query<{ id: number }>('SELECT id FROM tags WHERE name = ?', ['G13'])

  // ── Institutions ──────────────────────────────────────────────────────────
  execute(
    'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?, ?, ?, ?, ?, ?)',
    ['University of British Columbia', 'UBC', 'BC', 'University', 'https://www.ubc.ca', 'Sample data — fictional figures']
  )
  const ubcId = lastId()

  execute(
    'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?, ?, ?, ?, ?, ?)',
    ['University of Toronto', 'UOFT', 'ON', 'University', 'https://www.utoronto.ca', 'Sample data — fictional figures']
  )
  const uoftId = lastId()

  // ── institution_tags ──────────────────────────────────────────────────────
  execute('INSERT INTO institution_tags (institution_id, tag_id) VALUES (?, ?)', [ubcId, tagRI.id])
  execute('INSERT INTO institution_tags (institution_id, tag_id) VALUES (?, ?)', [uoftId, tagRI.id])
  execute('INSERT INTO institution_tags (institution_id, tag_id) VALUES (?, ?)', [uoftId, tagG13.id])

  // ── Documents ─────────────────────────────────────────────────────────────
  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ubcId, 'UBC_Annual_Report_2023.pdf', 'Annual Report', '2023', 'processed', 142, 58300]
  )
  const ubcDoc2023 = lastId()

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ubcId, 'UBC_Financial_Statements_2022.pdf', 'Financial Statement', '2022', 'processed', 48, 19200]
  )
  const ubcDoc2022 = lastId()

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uoftId, 'UToronto_Annual_Report_2023.pdf', 'Annual Report', '2023', 'processed', 168, 71500]
  )
  const uoftDoc2023 = lastId()

  // ── Financial Summaries ───────────────────────────────────────────────────
  const financialCols = `(institution_id, document_id, fiscal_year,
    total_revenue, total_expenses, net_surplus_deficit,
    operating_revenue, operating_expenses, government_grants,
    tuition_revenue, research_revenue, investment_income,
    total_assets, total_liabilities, net_assets,
    endowment_value, international_student_revenue)`

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    ubcId, ubcDoc2022, '2022',
    3_420_000_000, 3_290_000_000, 130_000_000,
    2_980_000_000, 2_870_000_000, 890_000_000,
    1_020_000_000, 680_000_000, 142_000_000,
    8_200_000_000, 2_900_000_000, 5_300_000_000,
    2_100_000_000, 420_000_000,
  ])

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    ubcId, ubcDoc2023, '2023',
    3_610_000_000, 3_450_000_000, 160_000_000,
    3_140_000_000, 3_010_000_000, 920_000_000,
    1_090_000_000, 730_000_000, 168_000_000,
    8_650_000_000, 2_980_000_000, 5_670_000_000,
    2_310_000_000, 455_000_000,
  ])

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    uoftId, uoftDoc2023, '2023',
    4_820_000_000, 4_590_000_000, 230_000_000,
    4_210_000_000, 4_020_000_000, 1_140_000_000,
    1_580_000_000, 1_240_000_000, 215_000_000,
    11_400_000_000, 3_800_000_000, 7_600_000_000,
    3_050_000_000, 610_000_000,
  ])

  // ── Strategic Plans + Priorities ──────────────────────────────────────────
  execute(
    `INSERT INTO strategic_plans (institution_id, document_id, plan_name, plan_period_start, plan_period_end, vision_statement)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      ubcId, ubcDoc2023,
      "Shaping UBC's Next Century 2021–2026",
      '2021', '2026',
      "To be one of the world's great universities — advancing a better world through excellence in research, learning, and community engagement.",
    ]
  )
  const ubcPlanId = lastId()

  const ubcPriorities: [string, string, string, string, string[]][] = [
    [
      'Advancing Research Excellence', 'Excellence', 'On Track',
      'Strengthen UBC\'s position as a top-10 global research university through increased funding, talent recruitment, and cross-disciplinary collaboration.',
      ['Recruit 50 Canada Research Chairs by 2025', 'Establish 3 new interdisciplinary research institutes', 'Double industry partnership revenue'],
    ],
    [
      'Transforming Learning Experiences', 'Excellence', 'On Track',
      'Reimagine undergraduate and graduate education through experiential learning, flexible pathways, and integration of Indigenous knowledge.',
      ['Launch UBC Online credential programs in 5 new disciplines', 'Expand co-op placements by 30%', 'Integrate Indigenous perspectives into all core curricula'],
    ],
    [
      'Fostering Indigenous Flourishing', 'Inclusion', 'On Track',
      'Advance Indigenous peoples\' self-determination, support Indigenous student success, and implement the Truth and Reconciliation Commission calls to action.',
      ['Increase Indigenous student enrolment by 40%', 'Hire 20 Indigenous faculty members', 'Complete Reconciliation Framework implementation'],
    ],
    [
      'Building an Inclusive Community', 'Inclusion', 'At Risk',
      'Create a campus culture where every student, faculty, and staff member experiences genuine belonging, equity, and respect.',
      ['Implement anti-racism action plan', 'Achieve pay equity across all staff classifications', 'Expand mental health services by 50%'],
    ],
    [
      'Accelerating Climate Action', 'Excellence', 'On Track',
      'Achieve carbon neutrality by 2035 and embed sustainability across all UBC operations and academic programs.',
      ['Transition campus fleet to zero-emission vehicles by 2027', 'Retrofit 10 legacy buildings to net-zero standard', 'Launch Climate Emergency Fund'],
    ],
  ]

  for (const [name, pillar, status, desc, initiatives] of ubcPriorities) {
    execute(
      `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, document_id, priority_name, priority_description, pillar, progress_status, key_initiatives)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ubcId, ubcPlanId, ubcDoc2023, name, desc, pillar, status, JSON.stringify(initiatives)]
    )
  }

  execute(
    `INSERT INTO strategic_plans (institution_id, document_id, plan_name, plan_period_start, plan_period_end, vision_statement)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      uoftId, uoftDoc2023,
      'Towards 2030: A Strategic Vision',
      '2023', '2030',
      'To be a globally pre-eminent university, driving innovation and discovery for the benefit of humanity.',
    ]
  )
  const uoftPlanId = lastId()

  const uoftPriorities: [string, string, string, string, string[]][] = [
    [
      'Research Impact at Scale', 'Research', 'On Track',
      'Position U of T as the leading research university in North America, with breakthrough contributions across health, AI, sustainability, and social innovation.',
      ['Grow annual research revenue to $2B by 2030', 'Launch U of T AI Institute', 'Establish 5 new Canada Excellence Research Chairs'],
    ],
    [
      'Student Success and Wellbeing', 'People', 'On Track',
      'Ensure every student — undergraduate and graduate — has access to the support, mentorship, and resources needed to thrive academically and personally.',
      ['Double mental health counsellor capacity', 'Introduce guaranteed financial aid for low-income undergraduates', 'Expand co-curricular transcript program'],
    ],
    [
      'Equity, Diversity, and Inclusion', 'People', 'At Risk',
      'Build a fully inclusive university where all community members experience equitable access to opportunities and are valued for their contributions.',
      ['Achieve gender parity in senior leadership by 2026', 'Increase Black and Indigenous faculty representation by 60%', 'Implement universal design standards in all new buildings'],
    ],
  ]

  for (const [name, pillar, status, desc, initiatives] of uoftPriorities) {
    execute(
      `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, document_id, priority_name, priority_description, pillar, progress_status, key_initiatives)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uoftId, uoftPlanId, uoftDoc2023, name, desc, pillar, status, JSON.stringify(initiatives)]
    )
  }

  // ── Sustainability Metrics ────────────────────────────────────────────────
  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ubcId, ubcDoc2022, '2022', 78400, 28100, 19600, 30700, 1_240_000, 38, 64, 3_800_000, '2035', JSON.stringify(['LEED Gold', 'ISO 14001'])]
  )

  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ubcId, ubcDoc2023, '2023', 74200, 26400, 18100, 29700, 1_190_000, 42, 67, 3_620_000, '2035', JSON.stringify(['LEED Gold', 'ISO 14001'])]
  )

  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uoftId, uoftDoc2023, '2023', 112600, 41800, 28400, 42400, 1_820_000, 29, 58, 5_100_000, '2050', JSON.stringify(['STARS Gold'])]
  )

  // ── KPI Datapoints ────────────────────────────────────────────────────────
  const kpiCols = `(institution_id, document_id, kpi_name, kpi_category, value, unit, fiscal_year, notes)`

  const ubcKpis: [string, string, number, string, string, string][] = [
    ['Total Student Enrolment', 'Enrolment', 68420, 'students', '2023', 'FTE, all programs'],
    ['International Student Enrolment', 'Enrolment', 18960, 'students', '2023', '~28% of total enrolment'],
    ['Indigenous Student Enrolment', 'Indigenous', 1840, 'students', '2023', 'Self-identified'],
    ['Annual Research Revenue', 'Research', 730_000_000, 'CAD', '2023', 'Includes tri-council and industry'],
    ['Research Publications', 'Research', 9200, 'publications', '2023', 'Peer-reviewed, calendar year'],
    ['6-Year Graduation Rate', 'Student Success', 84.2, '%', '2023', 'Undergraduate cohort'],
    ['Student Satisfaction Score', 'Student Success', 78, '%', '2023', 'Annual survey'],
    ['Operating Cost per Student', 'Financial', 50400, 'CAD', '2023', 'Full-time equivalent'],
  ]

  for (const [name, cat, val, unit, year, notes] of ubcKpis) {
    execute(`INSERT INTO kpi_datapoints ${kpiCols} VALUES (?,?,?,?,?,?,?,?)`, [ubcId, ubcDoc2023, name, cat, val, unit, year, notes])
  }

  const uoftKpis: [string, string, number, string, string, string][] = [
    ['Total Student Enrolment', 'Enrolment', 97020, 'students', '2023', 'FTE, all programs'],
    ['International Student Enrolment', 'Enrolment', 28500, 'students', '2023', '~29% of total enrolment'],
    ['Indigenous Student Enrolment', 'Indigenous', 2200, 'students', '2023', 'Self-identified'],
    ['Annual Research Revenue', 'Research', 1_240_000_000, 'CAD', '2023', 'Largest in Canada'],
    ['Research Publications', 'Research', 17400, 'publications', '2023', 'Peer-reviewed, calendar year'],
    ['6-Year Graduation Rate', 'Student Success', 87.5, '%', '2023', 'Undergraduate cohort'],
    ['Industry Partnership Agreements', 'Research', 412, 'agreements', '2023', 'Active in fiscal year'],
    ['Operating Cost per Student', 'Financial', 49700, 'CAD', '2023', 'Full-time equivalent'],
  ]

  for (const [name, cat, val, unit, year, notes] of uoftKpis) {
    execute(`INSERT INTO kpi_datapoints ${kpiCols} VALUES (?,?,?,?,?,?,?,?)`, [uoftId, uoftDoc2023, name, cat, val, unit, year, notes])
  }

  saveDb()
}

export function backfillSeedData(): void {
  const ubc = query<{ id: number }>("SELECT id FROM institutions WHERE short_code = 'UBC'")[0]
  const uoft = query<{ id: number }>("SELECT id FROM institutions WHERE short_code = 'UOFT'")[0]
  if (!ubc || !uoft) return

  let dirty = false

  // Financials
  const finUbc = query<{ c: number }>('SELECT COUNT(*) as c FROM financial_summaries WHERE institution_id = ?', [ubc.id])[0]?.c ?? 0
  if (finUbc === 0) {
    const financialCols = `(institution_id, document_id, fiscal_year,
      total_revenue, total_expenses, net_surplus_deficit,
      operating_revenue, operating_expenses, government_grants,
      tuition_revenue, research_revenue, investment_income,
      total_assets, total_liabilities, net_assets,
      endowment_value, international_student_revenue)`
    execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      ubc.id, null, '2022',
      3_420_000_000, 3_290_000_000, 130_000_000,
      2_980_000_000, 2_870_000_000, 890_000_000,
      1_020_000_000, 680_000_000, 142_000_000,
      8_200_000_000, 2_900_000_000, 5_300_000_000,
      2_100_000_000, 420_000_000,
    ])
    execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      ubc.id, null, '2023',
      3_610_000_000, 3_450_000_000, 160_000_000,
      3_140_000_000, 3_010_000_000, 920_000_000,
      1_090_000_000, 730_000_000, 168_000_000,
      8_650_000_000, 2_980_000_000, 5_670_000_000,
      2_310_000_000, 455_000_000,
    ])
    dirty = true
  }

  const finUoft = query<{ c: number }>('SELECT COUNT(*) as c FROM financial_summaries WHERE institution_id = ?', [uoft.id])[0]?.c ?? 0
  if (finUoft === 0) {
    const financialCols = `(institution_id, document_id, fiscal_year,
      total_revenue, total_expenses, net_surplus_deficit,
      operating_revenue, operating_expenses, government_grants,
      tuition_revenue, research_revenue, investment_income,
      total_assets, total_liabilities, net_assets,
      endowment_value, international_student_revenue)`
    execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      uoft.id, null, '2023',
      4_820_000_000, 4_590_000_000, 230_000_000,
      4_210_000_000, 4_020_000_000, 1_140_000_000,
      1_580_000_000, 1_240_000_000, 215_000_000,
      11_400_000_000, 3_800_000_000, 7_600_000_000,
      3_050_000_000, 610_000_000,
    ])
    dirty = true
  }

  // Strategic plans + priorities
  const priUbc = query<{ c: number }>('SELECT COUNT(*) as c FROM strategic_priorities WHERE institution_id = ?', [ubc.id])[0]?.c ?? 0
  if (priUbc === 0) {
    execute(
      `INSERT INTO strategic_plans (institution_id, plan_name, plan_period_start, plan_period_end, vision_statement)
       VALUES (?, ?, ?, ?, ?)`,
      [ubc.id, "Shaping UBC's Next Century 2021–2026", '2021', '2026',
        "To be one of the world's great universities — advancing a better world through excellence in research, learning, and community engagement."]
    )
    const ubcPlanId = query<{ id: number }>('SELECT last_insert_rowid() as id')[0].id
    const ubcPriorities: [string, string, string, string, string[]][] = [
      ['Advancing Research Excellence', 'Excellence', 'On Track',
        "Strengthen UBC's position as a top-10 global research university through increased funding, talent recruitment, and cross-disciplinary collaboration.",
        ['Recruit 50 Canada Research Chairs by 2025', 'Establish 3 new interdisciplinary research institutes', 'Double industry partnership revenue']],
      ['Transforming Learning Experiences', 'Excellence', 'On Track',
        'Reimagine undergraduate and graduate education through experiential learning, flexible pathways, and integration of Indigenous knowledge.',
        ['Launch UBC Online credential programs in 5 new disciplines', 'Expand co-op placements by 30%', 'Integrate Indigenous perspectives into all core curricula']],
      ['Fostering Indigenous Flourishing', 'Inclusion', 'On Track',
        "Advance Indigenous peoples' self-determination, support Indigenous student success, and implement the Truth and Reconciliation Commission calls to action.",
        ['Increase Indigenous student enrolment by 40%', 'Hire 20 Indigenous faculty members', 'Complete Reconciliation Framework implementation']],
      ['Building an Inclusive Community', 'Inclusion', 'At Risk',
        'Create a campus culture where every student, faculty, and staff member experiences genuine belonging, equity, and respect.',
        ['Implement anti-racism action plan', 'Achieve pay equity across all staff classifications', 'Expand mental health services by 50%']],
      ['Accelerating Climate Action', 'Excellence', 'On Track',
        'Achieve carbon neutrality by 2035 and embed sustainability across all UBC operations and academic programs.',
        ['Transition campus fleet to zero-emission vehicles by 2027', 'Retrofit 10 legacy buildings to net-zero standard', 'Launch Climate Emergency Fund']],
    ]
    for (const [name, pillar, status, desc, initiatives] of ubcPriorities) {
      execute(
        `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, priority_name, priority_description, pillar, progress_status, key_initiatives)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ubc.id, ubcPlanId, name, desc, pillar, status, JSON.stringify(initiatives)]
      )
    }
    dirty = true
  }

  const priUoft = query<{ c: number }>('SELECT COUNT(*) as c FROM strategic_priorities WHERE institution_id = ?', [uoft.id])[0]?.c ?? 0
  if (priUoft === 0) {
    execute(
      `INSERT INTO strategic_plans (institution_id, plan_name, plan_period_start, plan_period_end, vision_statement)
       VALUES (?, ?, ?, ?, ?)`,
      [uoft.id, 'Towards 2030: A Strategic Vision', '2023', '2030',
        'To be a globally pre-eminent university, driving innovation and discovery for the benefit of humanity.']
    )
    const uoftPlanId = query<{ id: number }>('SELECT last_insert_rowid() as id')[0].id
    const uoftPriorities: [string, string, string, string, string[]][] = [
      ['Research Impact at Scale', 'Research', 'On Track',
        'Position U of T as the leading research university in North America, with breakthrough contributions across health, AI, sustainability, and social innovation.',
        ['Grow annual research revenue to $2B by 2030', 'Launch U of T AI Institute', 'Establish 5 new Canada Excellence Research Chairs']],
      ['Student Success and Wellbeing', 'People', 'On Track',
        'Ensure every student — undergraduate and graduate — has access to the support, mentorship, and resources needed to thrive academically and personally.',
        ['Double mental health counsellor capacity', 'Introduce guaranteed financial aid for low-income undergraduates', 'Expand co-curricular transcript program']],
      ['Equity, Diversity, and Inclusion', 'People', 'At Risk',
        'Build a fully inclusive university where all community members experience equitable access to opportunities and are valued for their contributions.',
        ['Achieve gender parity in senior leadership by 2026', 'Increase Black and Indigenous faculty representation by 60%', 'Implement universal design standards in all new buildings']],
    ]
    for (const [name, pillar, status, desc, initiatives] of uoftPriorities) {
      execute(
        `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, priority_name, priority_description, pillar, progress_status, key_initiatives)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uoft.id, uoftPlanId, name, desc, pillar, status, JSON.stringify(initiatives)]
      )
    }
    dirty = true
  }

  // Sustainability
  const susUbc = query<{ c: number }>('SELECT COUNT(*) as c FROM sustainability_metrics WHERE institution_id = ?', [ubc.id])[0]?.c ?? 0
  if (susUbc === 0) {
    execute(
      `INSERT INTO sustainability_metrics
        (institution_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
         energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
         net_zero_target_year, sustainability_certifications)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ubc.id, '2022', 78400, 28100, 19600, 30700, 1_240_000, 38, 64, 3_800_000, '2035', JSON.stringify(['LEED Gold', 'ISO 14001'])]
    )
    execute(
      `INSERT INTO sustainability_metrics
        (institution_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
         energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
         net_zero_target_year, sustainability_certifications)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ubc.id, '2023', 74200, 26400, 18100, 29700, 1_190_000, 42, 67, 3_620_000, '2035', JSON.stringify(['LEED Gold', 'ISO 14001'])]
    )
    dirty = true
  }

  const susUoft = query<{ c: number }>('SELECT COUNT(*) as c FROM sustainability_metrics WHERE institution_id = ?', [uoft.id])[0]?.c ?? 0
  if (susUoft === 0) {
    execute(
      `INSERT INTO sustainability_metrics
        (institution_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
         energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
         net_zero_target_year, sustainability_certifications)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uoft.id, '2023', 112600, 41800, 28400, 42400, 1_820_000, 29, 58, 5_100_000, '2050', JSON.stringify(['STARS Gold'])]
    )
    dirty = true
  }

  // KPIs
  const kpiCols = `(institution_id, kpi_name, kpi_category, value, unit, fiscal_year, notes)`

  const kpiUbc = query<{ c: number }>('SELECT COUNT(*) as c FROM kpi_datapoints WHERE institution_id = ?', [ubc.id])[0]?.c ?? 0
  if (kpiUbc === 0) {
    const ubcKpis: [string, string, number, string, string, string][] = [
      ['Total Student Enrolment', 'Enrolment', 68420, 'students', '2023', 'FTE, all programs'],
      ['International Student Enrolment', 'Enrolment', 18960, 'students', '2023', '~28% of total enrolment'],
      ['Indigenous Student Enrolment', 'Indigenous', 1840, 'students', '2023', 'Self-identified'],
      ['Annual Research Revenue', 'Research', 730_000_000, 'CAD', '2023', 'Includes tri-council and industry'],
      ['Research Publications', 'Research', 9200, 'publications', '2023', 'Peer-reviewed, calendar year'],
      ['6-Year Graduation Rate', 'Student Success', 84.2, '%', '2023', 'Undergraduate cohort'],
      ['Student Satisfaction Score', 'Student Success', 78, '%', '2023', 'Annual survey'],
      ['Operating Cost per Student', 'Financial', 50400, 'CAD', '2023', 'Full-time equivalent'],
    ]
    for (const [name, cat, val, unit, year, notes] of ubcKpis) {
      execute(`INSERT INTO kpi_datapoints ${kpiCols} VALUES (?,?,?,?,?,?,?)`, [ubc.id, name, cat, val, unit, year, notes])
    }
    dirty = true
  }

  const kpiUoft = query<{ c: number }>('SELECT COUNT(*) as c FROM kpi_datapoints WHERE institution_id = ?', [uoft.id])[0]?.c ?? 0
  if (kpiUoft === 0) {
    const uoftKpis: [string, string, number, string, string, string][] = [
      ['Total Student Enrolment', 'Enrolment', 97020, 'students', '2023', 'FTE, all programs'],
      ['International Student Enrolment', 'Enrolment', 28500, 'students', '2023', '~29% of total enrolment'],
      ['Indigenous Student Enrolment', 'Indigenous', 2200, 'students', '2023', 'Self-identified'],
      ['Annual Research Revenue', 'Research', 1_240_000_000, 'CAD', '2023', 'Largest in Canada'],
      ['Research Publications', 'Research', 17400, 'publications', '2023', 'Peer-reviewed, calendar year'],
      ['6-Year Graduation Rate', 'Student Success', 87.5, '%', '2023', 'Undergraduate cohort'],
      ['Industry Partnership Agreements', 'Research', 412, 'agreements', '2023', 'Active in fiscal year'],
      ['Operating Cost per Student', 'Financial', 49700, 'CAD', '2023', 'Full-time equivalent'],
    ]
    for (const [name, cat, val, unit, year, notes] of uoftKpis) {
      execute(`INSERT INTO kpi_datapoints ${kpiCols} VALUES (?,?,?,?,?,?,?)`, [uoft.id, name, cat, val, unit, year, notes])
    }
    dirty = true
  }

  if (dirty) saveDb()
}

export function clearAndReseed(): void {
  const tables = [
    'analysis_findings', 'analysis_runs', 'institution_themes',
    'kpi_datapoints', 'sustainability_metrics',
    'strategic_priorities', 'strategic_plans',
    'financial_summaries', 'documents',
    'institution_tags', 'institutions', 'tags',
  ]
  for (const t of tables) execute(`DELETE FROM ${t}`)
  seedDatabase()
}
