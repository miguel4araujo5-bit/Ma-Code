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
  accessApiSource,
  accessWorkerSource,
  opaqueBridgeSource,
  preferenceSource,
  routeGeneratorSource
] =
  await Promise.all([
    read('src/pages/App.tsx'),
    read('src/pages/MAProfessorPrivacyPage.tsx'),
    read('src/pages/MAProfessorTermsPage.tsx'),
    read('src/components/ma-professor/access/MAProfessorAuthGate.tsx'),
    read('src/components/ma-professor/access/accessApi.ts'),
    read('worker/maProfessorAccess.ts'),
    read('worker/maProfessorAccessAuthBridge.ts'),
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
      /password pessoal não é enviada à MA-CODE/
    )
    assert.match(
      privacySource,
      /servidor não guarda material suficiente para decifrar a cópia/
    )
    assert.doesNotMatch(
      privacySource,
      /proteção v[23]/
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


test(
  'accepted terms version is carried by the existing activation request and persisted with a timestamp',
  () => {
    assert.match(
      accessApiSource,
      /MA_PROFESSOR_TERMS_VERSION\s*=\s*\n\s*'2026-09-22'/
    )
    assert.match(
      authGateSource,
      /activateMAProfessorAccessPeriod\([\s\S]*MA_PROFESSOR_TERMS_VERSION/
    )
    assert.match(
      accessApiSource,
      /termsVersion\?: string[\s\S]*\.\.\.\(termsVersion/
    )
    assert.match(
      opaqueBridgeSource,
      /const termsVersion =[\s\S]*body\.termsVersion[\s\S]*JSON\.stringify\(\{[\s\S]*termsVersion/
    )
    assert.match(
      accessWorkerSource,
      /CURRENT_TERMS_VERSION\s*=\s*\n\s*'2026-09-22'/
    )
    assert.match(
      accessWorkerSource,
      /termsVersionAccepted\?:[\s\S]*termsAcceptedAt\?:/
    )
    assert.match(
      accessWorkerSource,
      /termsVersion ===\s*CURRENT_TERMS_VERSION[\s\S]*request\.termsVersionAccepted[\s\S]*request\.termsAcceptedAt/
    )
  }
)
