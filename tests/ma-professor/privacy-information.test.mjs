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
  termsSource,
  authGateSource,
  preferenceSource,
  routeGeneratorSource
] =
  await Promise.all([
    read('src/pages/App.tsx'),
    read('src/pages/MAProfessorPrivacyPage.tsx'),
    read('src/pages/MAProfessorTermsPage.tsx'),
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


test(
  'MA-Professor terms publish the Article 28 processing conditions and authorised-use guard',
  () => {
    assert.match(
      appSource,
      /'\/termos\/ma-professor'/
    )
    assert.match(
      appSource,
      /type:\s*'ma-professor-terms'/
    )
    assert.match(
      appSource,
      /<MAProfessorTermsPage \/>/
    )
    assert.match(
      routeGeneratorSource,
      /route:\s*'\/termos\/ma-professor'/
    )
    assert.match(
      termsSource,
      /artigo 28\.º do RGPD/
    )
    assert.match(
      termsSource,
      /só deve introduzir dados reais de alunos quando estiver autorizado/
    )
    assert.match(
      termsSource,
      /Cloudflare/
    )
    assert.match(
      termsSource,
      /Resend/
    )
    assert.match(
      termsSource,
      /aceites por pessoa com poderes para a representar/
    )
  }
)

test(
  'privacy and activation flows expose provider roles and institutional authorisation',
  () => {
    assert.match(
      privacySource,
      /atividade exercida em nome individual/
    )
    assert.match(
      privacySource,
      /Resend/
    )
    assert.match(
      privacySource,
      /href="\/termos\/ma-professor"/
    )
    assert.match(
      authGateSource,
      /href="\/termos\/ma-professor"/
    )
    assert.match(
      authGateSource,
      /Se introduzir dados reais de alunos/
    )
    assert.match(
      authGateSource,
      /autorizada pela entidade responsável/
    )
  }
)
