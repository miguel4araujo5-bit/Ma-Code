import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const calendarWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/calendarWorkspaceRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const dailyViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const dailyRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'Daily resolves the planification suggestion from the exact module/UFCD of the selected lesson',
  () => {
    assert.match(
      calendarWorkspaceSource,
      /getNextPlanificationItem\(\s*lesson\.moduleId\s*\)/
    )
    assert.match(
      lessonRepositorySource,
      /planifications[\s\S]*where\(\s*'moduleId'\s*\)[\s\S]*equals\(\s*moduleId\s*\)/
    )
    assert.match(
      lessonRepositorySource,
      /planification\.active/
    )
  }
)

test(
  'the next suggestion is the first still-planned unused item in planification order',
  () => {
    assert.match(
      lessonRepositorySource,
      /item\.status\s*===\s*'planned'[\s\S]*!item\.usedLessonId/
    )
    assert.match(
      lessonRepositorySource,
      /left\.order\s*-\s*right\.order/
    )
  }
)

test(
  'using the Daily suggestion copies editable planification text into the lesson draft and records its item id',
  () => {
    assert.match(
      dailyViewSource,
      /item\.suggestedSummary\.trim\(\)\s*\|\|\s*item\.content\.trim\(\)/
    )
    assert.match(
      dailyViewSource,
      /plannedActivity:[\s\S]*item\.activity\.trim\(\)[\s\S]*\|\|[\s\S]*item\.content\.trim\(\)/
    )
    assert.match(
      dailyViewSource,
      /summarySource:[\s\S]*'planification'/
    )
    assert.match(
      dailyViewSource,
      /planificationItemIds:\s*\[\s*item\.id\s*\]/
    )
  }
)

test(
  'Daily persists the selected planification item only through the explicit lesson save flow',
  () => {
    assert.match(
      dailyViewSource,
      /dailyWorkspaceRepository\.saveLesson\(\s*\{[\s\S]*planificationItemIds:[\s\S]*lessonForm[\s\S]*\.planificationItemIds/
    )
    assert.match(
      dailyRepositorySource,
      /planificationItemIds:[\s\S]*input\.planificationItemIds/
    )
  }
)

test(
  'planification progression is consumed only when the lesson is taught, not merely prepared',
  () => {
    assert.match(
      lessonRepositorySource,
      /const shouldBeUsed\s*=\s*selectedNext\s*&&\s*nextLesson\.status\s*===\s*'taught'/
    )
    assert.match(
      lessonRepositorySource,
      /status:\s*'used'[\s\S]*usedLessonId:\s*nextLesson\.id/
    )
  }
)
