import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path =>
  readFile(
    new URL(
      `../../${path}`,
      import.meta.url
    ),
    'utf8'
  )

const [
  appSource,
  privacySource,
  authGateSource,
  preferenceSource,
  routeGeneratorSource
] =
  await Promise.all([
    read('src/pages/App.tsx'),
    read('src/pages/MAProfessorPrivacyPage.tsx'),
    read('src/components/ma-professor/access/MAProfessorAuthGate.tsx'),
    read('src/components/ma-professor/sync/CloudBackupPreferencePanel.tsx'),
    read('scripts/generate-route-html.mjs')
  ])

test(
  'MA-Professor privacy information has a public application route and generated route HTML',
  () => {
    assert.match(
      appSource,
      /'\/privacidade\/ma-professor'/
    )
    assert.match(
      appSource,
      /type:\s*'ma-professor-privacy'/
    )
    assert.match(
      appSource,
      /<MAProfessorPrivacyPage \/>/
    )
    assert.match(
      routeGeneratorSource,
      /route:\s*'\/privacidade\/ma-professor'/
    )
  }
)

test(
  'privacy information reflects current account, backup and retention contracts',
  () => {
    assert.match(
      privacySource,
      /responsável pelo tratamento é a <strong[^>]*>MA-CODE<\/strong>/
    )
    assert.match(
      privacySource,
      /acesso\.prof@ma-code\.pt/
    )
    assert.match(
      privacySource,
      /proteção v3/
    )
    assert.match(
      privacySource,
      /proteção v2/
    )
    assert.match(
      privacySource,
      /180 dias/
    )
    assert.match(
      privacySource,
      /Cloudflare/
    )
    assert.match(
      privacySource,
      /Comissão Nacional de Proteção de Dados \(CNPD\)/
    )
    assert.doesNotMatch(
      privacySource,
      /zero-knowledge|ponta-a-ponta/i
    )
  }
)

test(
  'activation and cloud-backup surfaces expose the privacy information',
  () => {
    assert.match(
      authGateSource,
      /href="\/privacidade\/ma-professor"/
    )
    assert.match(
      preferenceSource,
      /href="\/privacidade\/ma-professor"/
    )
  }
)
