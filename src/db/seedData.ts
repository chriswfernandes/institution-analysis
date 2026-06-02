import { execute, query, saveDb } from './db'

function lastId(): number {
  const [row] = query<{ id: number }>('SELECT last_insert_rowid() as id')
  return row.id
}

export function seedDatabase(): void {
  const [existing] = query<{ c: number }>(
    "SELECT COUNT(*) as c FROM institutions WHERE short_code IN ('UBC', 'UOFT', 'SFU', 'UVIC', 'OC')"
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

  // ── SFU ───────────────────────────────────────────────────────────────────
  execute("INSERT OR IGNORE INTO tags (name, colour) VALUES (?, ?)", ['Comprehensive', '#9333ea'])
  const [tagComp] = query<{ id: number }>('SELECT id FROM tags WHERE name = ?', ['Comprehensive'])

  execute(
    'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?, ?, ?, ?, ?, ?)',
    ['Simon Fraser University', 'SFU', 'BC', 'University', 'https://www.sfu.ca', 'Sample data — fictional figures']
  )
  const sfuId = lastId()
  execute('INSERT INTO institution_tags (institution_id, tag_id) VALUES (?, ?)', [sfuId, tagRI.id])
  execute('INSERT INTO institution_tags (institution_id, tag_id) VALUES (?, ?)', [sfuId, tagComp.id])

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sfuId, 'SFU_Financial_Statements_2022.pdf', 'Financial Statement', '2022', 'processed', 52, 20800]
  )
  const sfuDoc2022 = lastId()

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sfuId, 'SFU_Financial_Statements_2023.pdf', 'Financial Statement', '2023', 'processed', 54, 21600]
  )
  const sfuDoc2023 = lastId()

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sfuId, 'SFU_Strategic_Plan_2022-2027.pdf', 'Strategic Plan', '2022', 'processed', 38, 14200]
  )
  const sfuDocPlan = lastId()

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    sfuId, sfuDoc2022, '2022',
    1_042_000_000, 1_008_000_000, 34_000_000,
    910_000_000, 882_000_000, 298_000_000,
    312_000_000, 168_000_000, 38_000_000,
    2_480_000_000, 890_000_000, 1_590_000_000,
    420_000_000, 88_000_000,
  ])

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    sfuId, sfuDoc2023, '2023',
    1_098_000_000, 1_059_000_000, 39_000_000,
    958_000_000, 924_000_000, 310_000_000,
    332_000_000, 182_000_000, 42_000_000,
    2_610_000_000, 920_000_000, 1_690_000_000,
    450_000_000, 96_000_000,
  ])

  execute(
    `INSERT INTO strategic_plans (institution_id, document_id, plan_name, plan_period_start, plan_period_end, vision_statement)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sfuId, sfuDocPlan, 'SFU Vision 2025: Transforming Lives, Inspiring Innovation', '2022', '2027',
      'To be Canada\'s most engaged research university — connecting knowledge, people, and place for the benefit of society.']
  )
  const sfuPlanId = lastId()

  const sfuPriorities: [string, string, string, string, string[]][] = [
    ['Engaged Research', 'Research', 'On Track',
      'Amplify the societal impact of SFU research by deepening community partnerships, increasing external funding, and expanding interdisciplinary institutes.',
      ['Grow Tri-Council funding by 25% by 2027', 'Launch 2 new community-embedded research centres', 'Increase industry co-investment to $80M annually']],
    ['Student Experience and Success', 'Learning', 'On Track',
      'Deliver an outstanding student experience through flexible program pathways, co-op expansion, and wraparound academic supports.',
      ['Expand co-op enrolment to 12,000 students', 'Introduce guaranteed work-integrated learning for all programs', 'Reduce time-to-completion for graduate students by 10%']],
    ['Indigeneity and Decolonization', 'Inclusion', 'At Risk',
      'Embed Indigenous ways of knowing across the curriculum, increase Indigenous student success, and build meaningful Nation-to-Nation relationships.',
      ['Double Indigenous student enrolment by 2027', 'Implement Indigenous curriculum requirement across all faculties', 'Co-develop land acknowledgement framework with local Nations']],
    ['Sustainability and Climate Action', 'Operations', 'On Track',
      'Achieve carbon neutrality across all three SFU campuses by 2040 through energy retrofits, renewable procurement, and behaviour change programs.',
      ['Install 2MW of rooftop solar at Burnaby campus', 'Achieve LEED Gold on all new capital projects', 'Reduce Scope 1 & 2 emissions by 50% by 2027']],
  ]

  for (const [name, pillar, status, desc, initiatives] of sfuPriorities) {
    execute(
      `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, document_id, priority_name, priority_description, pillar, progress_status, key_initiatives)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sfuId, sfuPlanId, sfuDocPlan, name, desc, pillar, status, JSON.stringify(initiatives)]
    )
  }

  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [sfuId, sfuDoc2022, '2022', 34800, 12200, 8900, 13700, 521_000, 31, 55, 1_420_000, '2040', JSON.stringify(['STARS Silver'])]
  )
  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [sfuId, sfuDoc2023, '2023', 32100, 11400, 8200, 12500, 498_000, 36, 59, 1_360_000, '2040', JSON.stringify(['STARS Silver'])]
  )

  const sfuKpis: [string, string, number, string, string, string][] = [
    ['Total Student Enrolment', 'Enrolment', 37200, 'students', '2023', 'FTE, all programs'],
    ['International Student Enrolment', 'Enrolment', 9800, 'students', '2023', '~26% of total enrolment'],
    ['Indigenous Student Enrolment', 'Indigenous', 720, 'students', '2023', 'Self-identified'],
    ['Co-op Students Placed', 'Student Success', 8400, 'students', '2023', 'One of Canada\'s largest co-op programs'],
    ['Annual Research Revenue', 'Research', 182_000_000, 'CAD', '2023', 'Includes Tri-Council and NSERC Alliance'],
    ['Research Publications', 'Research', 3800, 'publications', '2023', 'Peer-reviewed, calendar year'],
    ['6-Year Graduation Rate', 'Student Success', 79.4, '%', '2023', 'Undergraduate cohort'],
    ['Operating Cost per Student', 'Financial', 29500, 'CAD', '2023', 'Full-time equivalent'],
  ]

  for (const [name, cat, val, unit, year, notes] of sfuKpis) {
    execute(`INSERT INTO kpi_datapoints ${kpiCols} VALUES (?,?,?,?,?,?,?,?)`, [sfuId, sfuDoc2023, name, cat, val, unit, year, notes])
  }

  // ── UVIC ──────────────────────────────────────────────────────────────────
  execute(
    'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?, ?, ?, ?, ?, ?)',
    ['University of Victoria', 'UVIC', 'BC', 'University', 'https://www.uvic.ca', 'Sample data — fictional figures']
  )
  const uvicId = lastId()
  execute('INSERT INTO institution_tags (institution_id, tag_id) VALUES (?, ?)', [uvicId, tagRI.id])

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uvicId, 'UVIC_Financial_Statements_2023.pdf', 'Financial Statement', '2023', 'processed', 46, 18400]
  )
  const uvicDoc2023 = lastId()

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uvicId, 'UVIC_Strategic_Plan_2023-2028.pdf', 'Strategic Plan', '2023', 'processed', 44, 16800]
  )
  const uvicDocPlan = lastId()

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    uvicId, uvicDoc2023, '2023',
    738_000_000, 712_000_000, 26_000_000,
    642_000_000, 621_000_000, 198_000_000,
    224_000_000, 104_000_000, 28_000_000,
    1_820_000_000, 640_000_000, 1_180_000_000,
    310_000_000, 68_000_000,
  ])

  execute(
    `INSERT INTO strategic_plans (institution_id, document_id, plan_name, plan_period_start, plan_period_end, vision_statement)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uvicId, uvicDocPlan, 'UVic Strategic Framework 2023–2028', '2023', '2028',
      'A university renowned for excellence, engagement, and its role as a force for good in the world.']
  )
  const uvicPlanId = lastId()

  const uvicPriorities: [string, string, string, string, string[]][] = [
    ['Excellence in Research and Creative Activity', 'Research', 'On Track',
      'Advance UVic\'s profile as a leading research university with particular strength in ocean science, Indigenous governance, climate, and health.',
      ['Secure $150M in new research grants by 2026', 'Establish Pacific Institute for Climate Solutions as flagship centre', 'Grow graduate enrolment by 15%']],
    ['Transformative Student Learning', 'Learning', 'On Track',
      'Provide students with a transformative academic experience grounded in experiential learning, interdisciplinary study, and Indigenous perspectives.',
      ['Launch universal experiential learning requirement by 2025', 'Expand Indigenous Studies pathway to 8 faculties', 'Improve 4-year graduation rate to 70%']],
    ['Reconciliation and Resurgence', 'Inclusion', 'On Track',
      'Advance the university\'s commitment to Indigenous resurgence through the UVic Indigenous Plan, honouring Coast Salish and Straits Salish peoples.',
      ['Increase Indigenous faculty to 5% of total complement', 'Implement all 94 TRC Calls to Action applicable to universities', 'Establish Indigenous language revitalization program']],
    ['Climate Action and Sustainability', 'Operations', 'At Risk',
      'Achieve net-zero carbon emissions by 2030 — one of the most ambitious timelines in Canadian post-secondary education.',
      ['Electrify all campus heating systems by 2027', 'Reduce fleet emissions to zero by 2026', 'Achieve STARS Platinum rating']],
  ]

  for (const [name, pillar, status, desc, initiatives] of uvicPriorities) {
    execute(
      `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, document_id, priority_name, priority_description, pillar, progress_status, key_initiatives)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uvicId, uvicPlanId, uvicDocPlan, name, desc, pillar, status, JSON.stringify(initiatives)]
    )
  }

  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uvicId, uvicDoc2023, '2023', 18400, 5900, 4200, 8300, 312_000, 54, 71, 980_000, '2030', JSON.stringify(['STARS Gold', 'LEED Silver'])]
  )

  const uvicKpis: [string, string, number, string, string, string][] = [
    ['Total Student Enrolment', 'Enrolment', 22400, 'students', '2023', 'FTE, all programs'],
    ['International Student Enrolment', 'Enrolment', 5200, 'students', '2023', '~23% of total enrolment'],
    ['Indigenous Student Enrolment', 'Indigenous', 890, 'students', '2023', 'Self-identified; includes Continuing Studies'],
    ['Annual Research Revenue', 'Research', 104_000_000, 'CAD', '2023', 'Includes NSERC, CIHR, SSHRC'],
    ['Research Publications', 'Research', 2100, 'publications', '2023', 'Peer-reviewed, calendar year'],
    ['6-Year Graduation Rate', 'Student Success', 82.1, '%', '2023', 'Undergraduate cohort'],
    ['Net Zero Target Year', 'Sustainability', 2030, 'year', '2023', 'Most ambitious net-zero target in BC post-secondary'],
    ['Operating Cost per Student', 'Financial', 32900, 'CAD', '2023', 'Full-time equivalent'],
  ]

  for (const [name, cat, val, unit, year, notes] of uvicKpis) {
    execute(`INSERT INTO kpi_datapoints ${kpiCols} VALUES (?,?,?,?,?,?,?,?)`, [uvicId, uvicDoc2023, name, cat, val, unit, year, notes])
  }

  // ── Okanagan College ───────────────────────────────────────────────────────
  execute("INSERT OR IGNORE INTO tags (name, colour) VALUES (?, ?)", ['College', '#ea580c'])
  const [tagCollege] = query<{ id: number }>('SELECT id FROM tags WHERE name = ?', ['College'])

  execute(
    'INSERT INTO institutions (name, short_code, province, institution_type, website, notes) VALUES (?, ?, ?, ?, ?, ?)',
    ['Okanagan College', 'OC', 'BC', 'College', 'https://www.okanagan.bc.ca', 'Sample data — fictional figures']
  )
  const ocId = lastId()
  execute('INSERT INTO institution_tags (institution_id, tag_id) VALUES (?, ?)', [ocId, tagCollege.id])

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ocId, 'OC_Financial_Statements_2022.pdf', 'Financial Statement', '2022', 'processed', 34, 12800]
  )
  const ocDoc2022 = lastId()

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ocId, 'OC_Financial_Statements_2023.pdf', 'Financial Statement', '2023', 'processed', 36, 13400]
  )
  const ocDoc2023 = lastId()

  execute(
    `INSERT INTO documents (institution_id, filename, document_type, fiscal_year, processing_status, page_count, word_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ocId, 'OC_Strategic_Plan_2021-2026.pdf', 'Strategic Plan', '2021', 'processed', 28, 10200]
  )
  const ocDocPlan = lastId()

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    ocId, ocDoc2022, '2022',
    142_000_000, 138_000_000, 4_000_000,
    124_000_000, 121_000_000, 58_000_000,
    42_000_000, null, 4_200_000,
    310_000_000, 92_000_000, 218_000_000,
    null, 8_400_000,
  ])

  execute(`INSERT INTO financial_summaries ${financialCols} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    ocId, ocDoc2023, '2023',
    158_000_000, 152_000_000, 6_000_000,
    138_000_000, 133_000_000, 64_000_000,
    48_000_000, null, 4_800_000,
    334_000_000, 98_000_000, 236_000_000,
    null, 10_200_000,
  ])

  execute(
    `INSERT INTO strategic_plans (institution_id, document_id, plan_name, plan_period_start, plan_period_end, vision_statement)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ocId, ocDocPlan, 'Okanagan College Strategic Plan 2021–2026', '2021', '2026',
      'To be the post-secondary institution of choice in BC\'s interior — delivering accessible, applied, and transformative education.']
  )
  const ocPlanId = lastId()

  const ocPriorities: [string, string, string, string, string[]][] = [
    ['Student Success and Completion', 'Learning', 'On Track',
      'Improve retention and completion rates across all credential types by embedding early-alert systems, enhanced advising, and flexible delivery.',
      ['Implement early-alert early-intervention system college-wide by 2023', 'Increase credential completion rate to 72% by 2026', 'Expand online and hybrid delivery to 40% of offerings']],
    ['Indigenous Education and Reconciliation', 'Inclusion', 'On Track',
      'Honour relationships with the Syilx Okanagan Nation and other local Nations by embedding Indigenous knowledge and supporting Indigenous learner success.',
      ['Achieve 15% Indigenous student enrolment by 2026', 'Require Indigenous cultural safety training for all employees', 'Co-develop Syilx Okanagan language courses with Nation Elders']],
    ['Workforce and Community Alignment', 'Community', 'On Track',
      'Ensure OC programs directly respond to regional labour market needs across agriculture, trades, health, technology, and tourism sectors.',
      ['Launch new trades seats: 200 additional by 2025', 'Establish agri-tech program in partnership with Okanagan growers', 'Expand health-care aide and LPN seats by 30%']],
    ['Organizational Sustainability', 'Operations', 'At Risk',
      'Strengthen the college\'s financial resilience and operational capacity to deliver on strategic priorities despite constrained provincial funding.',
      ['Diversify non-provincial revenue to 20% of total by 2026', 'Complete energy master plan for all four campuses', 'Reduce reliance on international student revenue concentration risk']],
  ]

  for (const [name, pillar, status, desc, initiatives] of ocPriorities) {
    execute(
      `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, document_id, priority_name, priority_description, pillar, progress_status, key_initiatives)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ocId, ocPlanId, ocDocPlan, name, desc, pillar, status, JSON.stringify(initiatives)]
    )
  }

  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ocId, ocDoc2022, '2022', 6200, 2400, 1800, 2000, 84_000, 22, 48, 310_000, '2050', JSON.stringify([])]
  )
  execute(
    `INSERT INTO sustainability_metrics
      (institution_id, document_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption,
       net_zero_target_year, sustainability_certifications)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ocId, ocDoc2023, '2023', 5800, 2200, 1600, 2000, 79_000, 26, 51, 290_000, '2050', JSON.stringify([])]
  )

  const ocKpis: [string, string, number, string, string, string][] = [
    ['Total Student Enrolment', 'Enrolment', 8940, 'students', '2023', 'FTE, credit and non-credit'],
    ['International Student Enrolment', 'Enrolment', 1820, 'students', '2023', '~20% of total enrolment'],
    ['Indigenous Student Enrolment', 'Indigenous', 1240, 'students', '2023', 'Self-identified; above provincial average'],
    ['Credential Completion Rate', 'Student Success', 66.4, '%', '2023', 'All credential types combined'],
    ['Trades Seats', 'Enrolment', 1640, 'seats', '2023', 'Apprenticeship and foundation programs'],
    ['Employment Rate (6 months post-grad)', 'Student Success', 88.2, '%', '2023', 'Graduate outcome survey'],
    ['Operating Cost per Student', 'Financial', 17800, 'CAD', '2023', 'Full-time equivalent'],
    ['Provincial Grant Revenue', 'Financial', 64_000_000, 'CAD', '2023', '~41% of total revenue'],
  ]

  for (const [name, cat, val, unit, year, notes] of ocKpis) {
    execute(`INSERT INTO kpi_datapoints ${kpiCols} VALUES (?,?,?,?,?,?,?,?)`, [ocId, ocDoc2023, name, cat, val, unit, year, notes])
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

  // ── SFU / UVIC / OC backfill ──────────────────────────────────────────────
  const sfu = query<{ id: number }>("SELECT id FROM institutions WHERE short_code = 'SFU'")[0]
  const uvic = query<{ id: number }>("SELECT id FROM institutions WHERE short_code = 'UVIC'")[0]
  const oc = query<{ id: number }>("SELECT id FROM institutions WHERE short_code = 'OC'")[0]

  for (const inst of [
    { row: sfu, code: 'SFU' },
    { row: uvic, code: 'UVIC' },
    { row: oc, code: 'OC' },
  ]) {
    if (!inst.row) continue
    const instId = inst.row.id
    const hasFin = (query<{ c: number }>('SELECT COUNT(*) as c FROM financial_summaries WHERE institution_id = ?', [instId])[0]?.c ?? 0) > 0
    const hasPri = (query<{ c: number }>('SELECT COUNT(*) as c FROM strategic_priorities WHERE institution_id = ?', [instId])[0]?.c ?? 0) > 0
    const hasSus = (query<{ c: number }>('SELECT COUNT(*) as c FROM sustainability_metrics WHERE institution_id = ?', [instId])[0]?.c ?? 0) > 0
    const hasKpi = (query<{ c: number }>('SELECT COUNT(*) as c FROM kpi_datapoints WHERE institution_id = ?', [instId])[0]?.c ?? 0) > 0
    if (!hasFin || !hasPri || !hasSus || !hasKpi) {
      // Missing data — re-seed this institution's data via clearAndReseed path is simplest;
      // user should use "Reset to Sample Data" in Settings to get the full dataset.
      dirty = true
    }
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
