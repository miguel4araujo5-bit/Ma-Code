from pathlib import Path


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} match(es), found {actual}')
    file_path.write_text(text.replace(old, new, count), encoding='utf-8')


atomic = 'src/components/ma-professor/setup/scheduleImportAtomicRepository.ts'
replace_exact(
    atomic,
    "const TEACHER_PROFILE_ID =\n  'local-profile'\n",
    "const TEACHER_PROFILE_ID =\n  'local-profile'\n\nconst S_BENTO_SCHOOL_NAME =\n  'Agrupamento de Escolas de S. Bento, Vizela'\n\nconst S_BENTO_CALENDAR_DESCRIPTION =\n  'Calendário Escolar 2026/2027 — Agrupamento de Escolas de S. Bento, Vizela.'\n\nfunction inferSchoolNameFromCalendarEvents(\n  events: SchoolCalendarEvent[]\n) {\n  return events.some(event =>\n    (event.description ?? '').includes(\n      S_BENTO_CALENDAR_DESCRIPTION\n    )\n  )\n    ? S_BENTO_SCHOOL_NAME\n    : ''\n}\n"
)
replace_exact(
    atomic,
    "  const [\n    academicYear,\n    profile\n  ] = await Promise.all([\n    maProfessorDb.academicYears.get(\n      academicYearId\n    ),\n    maProfessorDb.teacherProfiles.get(\n      TEACHER_PROFILE_ID\n    )\n  ])",
    "  const [\n    academicYear,\n    profile,\n    calendarEvents\n  ] = await Promise.all([\n    maProfessorDb.academicYears.get(\n      academicYearId\n    ),\n    maProfessorDb.teacherProfiles.get(\n      TEACHER_PROFILE_ID\n    ),\n    maProfessorDb.schoolCalendarEvents\n      .where('academicYearId')\n      .equals(academicYearId)\n      .toArray()\n  ])"
)
replace_exact(
    atomic,
    "  const schoolName =\n    profile?.schoolName\n      ?.trim() ?? ''",
    "  const schoolName =\n    profile?.schoolName\n      ?.trim() ||\n    inferSchoolNameFromCalendarEvents(\n      calendarEvents\n    )",
    1
)
replace_exact(
    atomic,
    "  if (\n    !requiresDutyDateRangeConfirmation(\n      academicYear,\n      schoolName\n    )\n  ) {\n    return\n  }",
    "  if (\n    !requiresDutyDateRangeConfirmation(\n      academicYear,\n      schoolName\n    )\n  ) {\n    return schoolName\n  }"
)
replace_exact(
    atomic,
    "  if (!confirmed) {\n    throw new Error(\n      'A programação dos cargos foi cancelada. Nenhuma alteração foi guardada.'\n    )\n  }\n}",
    "  if (!confirmed) {\n    throw new Error(\n      'A programação dos cargos foi cancelada. Nenhuma alteração foi guardada.'\n    )\n  }\n\n  return schoolName\n}"
)
replace_exact(
    atomic,
    "  if (duties.length > 0) {\n    await confirmGenericDutyDateRange(\n      input.academicYearId\n    )\n  }",
    "  const dutySchoolName =\n    duties.length > 0\n      ? await confirmGenericDutyDateRange(\n          input.academicYearId\n        )\n      : ''"
)
replace_exact(
    atomic,
    "        const schoolName =\n          profile?.schoolName\n            ?.trim() ?? ''",
    "        const schoolName =\n          profile?.schoolName\n            ?.trim() ||\n          dutySchoolName"
)

bootstrap = 'src/components/ma-professor/calendar/InitialSchoolCalendarBootstrap.tsx'
replace_exact(
    bootstrap,
    "        next: state => {\n          if (\n            disposed ||\n            !state ||\n            !isSBentoSchoolName(\n              state.schoolName\n            ) ||\n            !isMAProfessorOperationallyReady(\n              state.snapshot\n            )\n          ) {\n            return\n          }",
    "        next: state => {\n          if (\n            disposed ||\n            !state\n          ) {\n            return\n          }\n\n          if (!state.schoolName.trim()) {\n            setStage('selecting')\n            return\n          }\n\n          if (\n            !isSBentoSchoolName(\n              state.schoolName\n            ) ||\n            !isMAProfessorOperationallyReady(\n              state.snapshot\n            )\n          ) {\n            return\n          }"
)

test_path = Path('tests/ma-professor/schedule-duty-range-confirmation.test.mjs')
test_text = test_path.read_text(encoding='utf-8')
old_import = "const atomicSource = await readFile(\n  new URL(\n    '../../src/components/ma-professor/setup/scheduleImportAtomicRepository.ts',\n    import.meta.url\n  ),\n  'utf8'\n)\n"
new_import = old_import + "\nconst bootstrapSource = await readFile(\n  new URL(\n    '../../src/components/ma-professor/calendar/InitialSchoolCalendarBootstrap.tsx',\n    import.meta.url\n  ),\n  'utf8'\n)\n"
if test_text.count(old_import) != 1:
    raise SystemExit('target test import marker not found exactly once')
test_text = test_text.replace(old_import, new_import, 1)
test_text += r'''

test(
  'legacy S. Bento setup can recover the school from the configured calendar before scheduling duties',
  () => {
    assert.match(
      atomicSource,
      /S_BENTO_CALENDAR_DESCRIPTION/
    )
    assert.match(
      atomicSource,
      /inferSchoolNameFromCalendarEvents/
    )
    assert.match(
      atomicSource,
      /profile\?\.schoolName[\s\S]*inferSchoolNameFromCalendarEvents\([\s\S]*calendarEvents/
    )
    assert.match(
      atomicSource,
      /const dutySchoolName =[\s\S]*await confirmGenericDutyDateRange[\s\S]*profile\?\.schoolName[\s\S]*dutySchoolName/
    )
  }
)

test(
  'school bootstrap reopens school selection if the profile loses its school during the session',
  () => {
    assert.match(
      bootstrapSource,
      /if \(!state\.schoolName\.trim\(\)\) \{\s*setStage\('selecting'\)\s*return\s*\}/
    )
  }
)
'''
test_path.write_text(test_text, encoding='utf-8')
