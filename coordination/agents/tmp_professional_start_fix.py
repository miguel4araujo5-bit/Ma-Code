from pathlib import Path

source_path = Path('src/components/ma-professor/calendar/initialSchoolCalendar2026_2027.ts')
source = source_path.read_text(encoding='utf-8')

old_decl = "const SECONDARY_START_DATE: ISODate = '2026-09-21'"
new_decl = "const PROFESSIONAL_START_DATE: ISODate = '2026-09-14'"
if source.count(old_decl) != 1:
    raise SystemExit(f'expected one old start-date declaration, found {source.count(old_decl)}')
source = source.replace(old_decl, new_decl, 1)

old_refs = source.count('SECONDARY_START_DATE')
if old_refs != 4:
    raise SystemExit(f'expected four old start-date references after declaration replacement, found {old_refs}')
source = source.replace('SECONDARY_START_DATE', 'PROFESSIONAL_START_DATE')
source_path.write_text(source, encoding='utf-8')

test_path = Path('tests/ma-professor/regular-school-calendar-preset.test.mjs')
test_source = test_path.read_text(encoding='utf-8')
old_regex = 'dateFrom: SECONDARY_START_DATE'
if test_source.count(old_regex) != 1:
    raise SystemExit(f'expected one test reference, found {test_source.count(old_regex)}')
test_source = test_source.replace(old_regex, 'dateFrom: PROFESSIONAL_START_DATE', 1)

anchor = "test(\n  'preset lesson generation is scoped to each professional assignment and its own end date',"
if test_source.count(anchor) != 1:
    raise SystemExit('test anchor not found exactly once')
new_test = r"""test(
  'S. Bento professional teaching starts on 14 September while regular groups remain outside this preset',
  () => {
    assert.match(
      source,
      /const PROFESSIONAL_START_DATE: ISODate = '2026-09-14'/
    )
    assert.doesNotMatch(
      source,
      /const SECONDARY_START_DATE/
    )
    assert.match(
      source,
      /group\.educationType ===\s*'regular'[\s\S]*continue/
    )
  }
)

"""
test_source = test_source.replace(anchor, new_test + anchor, 1)
test_path.write_text(test_source, encoding='utf-8')
