import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const serviceSource = await readFile(
  new URL('../../worker/maProfessorEmailService.ts', import.meta.url),
  'utf8'
)

const notifierSource = await readFile(
  new URL('../../worker/maProfessorAccessAdminNotifier.ts', import.meta.url),
  'utf8'
)

const pilotSource = await readFile(
  new URL('../../worker/maProfessorPilotDecision.ts', import.meta.url),
  'utf8'
)

const fixedSource = await readFile(
  new URL('../../worker/maProfessorAdminFixed.ts', import.meta.url),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    diagnostic =>
      diagnostic.category === ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(
      diagnostic =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

function jsonResponse(body, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}

async function withCapturedResend(callback) {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      init
    })

    return jsonResponse({
      id: `email-${calls.length}`
    })
  }

  try {
    return await callback(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function withFailedResend(callback) {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      init
    })

    return jsonResponse(
      {
        message: 'Falha simulada do Resend.'
      },
      503
    )
  }

  try {
    return await callback(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function readPayload(call) {
  assert.equal(typeof call.init.body, 'string')
  return JSON.parse(call.init.body)
}

const serviceUrl = transpile(serviceSource)
const service = await import(serviceUrl)

const adminMatch = serviceSource.match(
  /const\s+ADMIN_NOTIFICATION_EMAIL\s*=\s*'([^']+)'/
)

assert.ok(adminMatch)
const adminEmail = adminMatch[1]

test(
  'admin notifications ignore any external recipient override',
  { concurrency: false },
  async () => {
    await withCapturedResend(
      async calls => {
        const requester = 'cliente@example.com'
        const env = {
          RESEND_API_KEY_MA_PROFESSOR: 'test-key',
          MA_PROFESSOR_ADMIN_EMAIL: requester
        }

        const first = await service
          .sendMAProfessorAdminAccessRequestEmail(
            env,
            {
              requesterEmail: requester,
              isNewRequest: true,
              submittedAt: '2026-08-27T10:00:00.000Z',
              originalRequestedAt:
                '2026-08-27T10:00:00.000Z'
            }
          )

        const repeat = await service
          .sendMAProfessorAdminAccessRequestEmail(
            env,
            {
              requesterEmail: requester,
              isNewRequest: false,
              submittedAt: '2026-08-27T11:00:00.000Z',
              originalRequestedAt:
                '2026-08-27T10:00:00.000Z'
            }
          )

        assert.equal(first.status, 'sent')
        assert.equal(repeat.status, 'sent')
        assert.equal(calls.length, 2)

        for (const call of calls) {
          const payload = readPayload(call)
          assert.deepEqual(payload.to, [adminEmail])
          assert.notEqual(payload.to[0], requester)
          assert.notEqual(
            payload.to[0],
            env.MA_PROFESSOR_ADMIN_EMAIL
          )
        }
      }
    )
  }
)

test(
  'admin notification is blocked if requester equals admin',
  { concurrency: false },
  async () => {
    await withCapturedResend(
      async calls => {
        const result = await service
          .sendMAProfessorAdminAccessRequestEmail(
            {
              RESEND_API_KEY_MA_PROFESSOR: 'test-key'
            },
            {
              requesterEmail: adminEmail,
              isNewRequest: true,
              submittedAt: '2026-08-27T10:00:00.000Z'
            }
          )

        assert.equal(result.status, 'blocked')
        assert.equal(calls.length, 0)
      }
    )
  }
)

test(
  'pilot approval and rejection go only to the professor',
  { concurrency: false },
  async () => {
    await withCapturedResend(
      async calls => {
        const env = {
          RESEND_API_KEY_MA_PROFESSOR: 'test-key'
        }
        const professor = 'docente@example.com'

        const approval = await service
          .sendMAProfessorPilotApprovalEmail(
            env,
            professor,
            'MP-AAAA-BBBB'
          )

        const rejection = await service
          .sendMAProfessorPilotRejectionEmail(
            env,
            professor
          )

        assert.equal(approval.status, 'sent')
        assert.equal(rejection.status, 'sent')
        assert.equal(calls.length, 2)

        for (const call of calls) {
          assert.deepEqual(
            readPayload(call).to,
            [professor]
          )
        }
      }
    )
  }
)

test(
  'commercial activation emits exactly one email to the professor',
  { concurrency: false },
  async () => {
    await withCapturedResend(
      async calls => {
        const professor = 'comercial@example.com'

        const result = await service
          .sendMAProfessorCommercialActivationEmail(
            {
              RESEND_API_KEY_MA_PROFESSOR: 'test-key'
            },
            professor,
            'MP-COMMERCIAL-1234'
          )

        assert.equal(result.status, 'sent')
        assert.equal(calls.length, 1)
        assert.deepEqual(
          readPayload(calls[0]).to,
          [professor]
        )
      }
    )
  }
)

test(
  'missing Resend transport never consumes a send attempt',
  { concurrency: false },
  async () => {
    await withCapturedResend(
      async calls => {
        const result = await service
          .sendMAProfessorPilotApprovalEmail(
            {},
            'docente@example.com',
            'MP-AAAA-BBBB'
          )

        assert.equal(
          result.status,
          'not_configured'
        )
        assert.equal(calls.length, 0)
      }
    )
  }
)

const bridgeStubUrl = transpile(`
  export const decideMAProfessorAccessRequest =
    (...args) =>
      globalThis.__pilotHooks.decide(...args)

  export const generateMAProfessorAdminCredential =
    (...args) =>
      globalThis.__pilotHooks.generate(...args)

  export const updateMAProfessorAdminEmailDispatchStatus =
    (...args) =>
      globalThis.__pilotHooks.update(...args)
`)

const pilotRuntimeSource = pilotSource
  .replaceAll(
    "'./maProfessorAccessAdminBridge'",
    `'${bridgeStubUrl}'`
  )
  .replaceAll(
    "'./maProfessorEmailService'",
    `'${serviceUrl}'`
  )

const pilot = await import(
  transpile(pilotRuntimeSource)
)

function installPilotHooks(mode) {
  let generated = 0

  globalThis.__pilotHooks = {
    get generated() {
      return generated
    },

    decide: async (
      _env,
      email,
      decision
    ) => {
      const status =
        decision === 'approve'
          ? 'approved'
          : 'rejected'

      const emailDispatchStatus =
        mode === 'commercial'
          ? 'not_applicable'
          : 'pending'

      return jsonResponse({
        success: true,
        decisionMode: mode,
        emailDispatchStatus,
        request: {
          email,
          status,
          decisionMode: mode,
          emailDispatchStatus
        }
      })
    },

    generate: async (_env, email) => {
      generated += 1

      return jsonResponse({
        success: true,
        credential: {
          email,
          password: 'MP-TEST-1234',
          hasCredential: true,
          createdAt:
            '2026-08-27T10:00:00.000Z',
          updatedAt:
            '2026-08-27T10:00:00.000Z'
        }
      })
    },

    update: async (_env, email, status) =>
      jsonResponse({
        success: true,
        request: {
          email,
          emailDispatchStatus: status
        }
      })
  }

  return globalThis.__pilotHooks
}

test(
  'pilot decision sends one approval and one rejection message, while commercial approval sends none',
  { concurrency: false },
  async () => {
    await withCapturedResend(
      async calls => {
        installPilotHooks('pilot')

        const approved = await pilot
          .processMAProfessorAccessDecision(
            {
              RESEND_API_KEY_MA_PROFESSOR: 'test-key'
            },
            'aprovado@example.com',
            'approve'
          )

        const rejected = await pilot
          .processMAProfessorAccessDecision(
            {
              RESEND_API_KEY_MA_PROFESSOR: 'test-key'
            },
            'rejeitado@example.com',
            'reject'
          )

        installPilotHooks('commercial')

        const commercial = await pilot
          .processMAProfessorAccessDecision(
            {
              RESEND_API_KEY_MA_PROFESSOR: 'test-key'
            },
            'comercial@example.com',
            'approve'
          )

        const approvedBody = await approved.json()
        const rejectedBody = await rejected.json()
        const commercialBody = await commercial.json()

        assert.equal(
          approvedBody.emailDelivery,
          'sent'
        )
        assert.equal(
          rejectedBody.emailDelivery,
          'sent'
        )
        assert.equal(
          commercialBody.emailDelivery,
          'not_applicable'
        )

        assert.equal(calls.length, 2)
        assert.deepEqual(
          readPayload(calls[0]).to,
          ['aprovado@example.com']
        )
        assert.deepEqual(
          readPayload(calls[1]).to,
          ['rejeitado@example.com']
        )
      }
    )
  }
)

test(
  'pilot approval without Resend still creates a credential for manual delivery',
  { concurrency: false },
  async () => {
    const hooks = installPilotHooks('pilot')

    await withCapturedResend(
      async calls => {
        const response = await pilot
          .processMAProfessorAccessDecision(
            {},
            'sem-resend-piloto@example.com',
            'approve'
          )

        const body = await response.json()

        assert.equal(
          body.emailDelivery,
          'not_configured'
        )
        assert.equal(
          body.credentialIssued,
          true
        )
        assert.equal(
          body.fallbackCredential.password,
          'MP-TEST-1234'
        )
        assert.equal(hooks.generated, 1)
        assert.equal(calls.length, 0)
      }
    )
  }
)

test(
  'pilot approval exposes the generated credential when Resend fails',
  { concurrency: false },
  async () => {
    const hooks = installPilotHooks('pilot')

    await withFailedResend(
      async calls => {
        const response = await pilot
          .processMAProfessorAccessDecision(
            {
              RESEND_API_KEY_MA_PROFESSOR:
                'test-key'
            },
            'falha-resend-piloto@example.com',
            'approve'
          )

        const body = await response.json()

        assert.equal(
          body.emailDelivery,
          'failed'
        )
        assert.equal(
          body.credentialIssued,
          true
        )
        assert.equal(
          body.fallbackCredential.password,
          'MP-TEST-1234'
        )
        assert.equal(hooks.generated, 1)
        assert.equal(calls.length, 1)
      }
    )
  }
)

test(
  'pilot rejection without Resend does not create a credential',
  { concurrency: false },
  async () => {
    const hooks = installPilotHooks('pilot')

    await withCapturedResend(
      async calls => {
        const response = await pilot
          .processMAProfessorAccessDecision(
            {},
            'rejeitado-sem-resend@example.com',
            'reject'
          )

        const body = await response.json()

        assert.equal(
          body.emailDelivery,
          'not_configured'
        )
        assert.equal(
          body.credentialIssued,
          false
        )
        assert.equal(hooks.generated, 0)
        assert.equal(calls.length, 0)
      }
    )
  }
)

const adminStubUrl = transpile(`
  export const isMAProfessorAdminApiPath =
    () => true

  export const handleMAProfessorAdminApiRequest =
    (...args) =>
      globalThis.__adminHooks.handle(...args)
`)

const adminBridgeStubUrl = transpile(`
  export const generateMAProfessorAdminCredential =
    (...args) =>
      globalThis.__adminHooks.generate(...args)

  export const updateMAProfessorAdminEmailDispatchStatus =
    (...args) =>
      globalThis.__adminHooks.update(...args)
`)

const explicitApprovalStubUrl = transpile(`
  export const decideMAProfessorAccessRequestExplicitly =
    (...args) =>
      globalThis.__adminHooks.explicitApprove(...args)
`)

const fixedRuntimeSource = fixedSource
  .replaceAll(
    "'./maProfessorAdmin'",
    `'${adminStubUrl}'`
  )
  .replaceAll(
    "'./maProfessorAccessAdminBridge'",
    `'${adminBridgeStubUrl}'`
  )
  .replaceAll(
    "'./maProfessorExplicitApprovalBridge'",
    `'${explicitApprovalStubUrl}'`
  )
  .replaceAll(
    "'./maProfessorEmailService'",
    `'${serviceUrl}'`
  )

const fixed = await import(
  transpile(fixedRuntimeSource)
)

function installAdminHooks() {
  let generated = 0

  globalThis.__adminHooks = {
    get generated() {
      return generated
    },

    handle: async request =>
      jsonResponse({
        success: true,
        message: 'Pagamento resolvido.',
        commerce: {
          paymentStatus:
            request.url.includes(
              'dispense-payment'
            )
              ? 'dispensed'
              : 'confirmed'
        }
      }),

    explicitApprove: async (
      _env,
      email,
      approvalPlan
    ) => {
      const decisionMode =
        approvalPlan === 'free'
          ? 'pilot'
          : 'commercial'

      const emailDispatchStatus =
        decisionMode === 'pilot'
          ? 'pending'
          : 'not_applicable'

      return jsonResponse({
        success: true,
        message: 'Pedido aprovado.',
        approvalPlan,
        decisionMode,
        emailDispatchStatus,
        request: {
          email,
          status: 'approved',
          decisionMode,
          emailDispatchStatus
        }
      })
    },

    update: async (
      _env,
      email,
      status
    ) =>
      jsonResponse({
        success: true,
        request: {
          email,
          status: 'approved',
          decisionMode: 'pilot',
          emailDispatchStatus: status
        }
      }),

    generate: async (_env, email) => {
      generated += 1
      return jsonResponse({
        success: true,
        credential: {
          email,
          password:
            'MP-COMMERCIAL-1234'
        },
        commerce: {
          credentialIssuedAt:
            '2026-08-27T10:00:00.000Z'
        }
      })
    }
  }

  return globalThis.__adminHooks
}

for (
  const action of
  ['confirm-payment', 'dispense-payment']
) {
  test(
    `${action} generates one credential and sends one activation email`,
    { concurrency: false },
    async () => {
      const hooks = installAdminHooks()

      await withCapturedResend(
        async calls => {
          const professor =
            `${action}@example.com`

          const response = await fixed
            .handleMAProfessorAdminApiRequest(
              new Request(
                `https://ma-code.pt/api/admin/ma-professor/commerce/${action}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':
                      'application/json'
                  },
                  body: JSON.stringify({
                    email: professor
                  })
                }
              ),
              {
                RESEND_API_KEY_MA_PROFESSOR:
                  'test-key'
              }
            )

          const body = await response.json()

          assert.equal(
            body.emailDelivery,
            'sent'
          )
          assert.equal(
            body.credentialIssued,
            true
          )
          assert.equal(hooks.generated, 1)
          assert.equal(calls.length, 1)
          assert.deepEqual(
            readPayload(calls[0]).to,
            [professor]
          )
        }
      )
    }
  )
}

test(
  'payment resolution without Resend creates a credential for manual delivery',
  { concurrency: false },
  async () => {
    const hooks = installAdminHooks()

    await withCapturedResend(
      async calls => {
        const response = await fixed
          .handleMAProfessorAdminApiRequest(
            new Request(
              'https://ma-code.pt/api/admin/ma-professor/commerce/confirm-payment',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json'
                },
                body: JSON.stringify({
                  email:
                    'sem-resend@example.com'
                })
              }
            ),
            {}
          )

        const body = await response.json()

        assert.equal(
          body.emailDelivery,
          'not_configured'
        )
        assert.equal(
          body.credentialIssued,
          true
        )
        assert.equal(
          body.fallbackCredential.password,
          'MP-COMMERCIAL-1234'
        )
        assert.equal(hooks.generated, 1)
        assert.equal(calls.length, 0)
      }
    )
  }
)

test(
  'explicit free approval creates one credential and sends one activation email',
  { concurrency: false },
  async () => {
    const hooks = installAdminHooks()

    await withCapturedResend(
      async calls => {
        const professor =
          'explicit-free@example.com'

        const response = await fixed
          .handleMAProfessorAdminApiRequest(
            new Request(
              'https://ma-code.pt/api/admin/ma-professor/requests/approve-plan',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json'
                },
                body: JSON.stringify({
                  email: professor,
                  approvalPlan: 'free'
                })
              }
            ),
            {
              RESEND_API_KEY_MA_PROFESSOR:
                'test-key'
            }
          )

        const body = await response.json()

        assert.equal(
          body.approvalPlan,
          'free'
        )
        assert.equal(
          body.emailDelivery,
          'sent'
        )
        assert.equal(
          body.credentialIssued,
          true
        )
        assert.equal(hooks.generated, 1)
        assert.equal(calls.length, 1)
        assert.deepEqual(
          readPayload(calls[0]).to,
          [professor]
        )
      }
    )
  }
)

for (
  const approvalPlan of
  ['paid_30_days', 'school_year']
) {
  test(
    `explicit ${approvalPlan} approval confirms payment, creates one credential and sends one activation email`,
    { concurrency: false },
    async () => {
      const hooks = installAdminHooks()

      await withCapturedResend(
        async calls => {
          const professor =
            `${approvalPlan}@example.com`

          const response = await fixed
            .handleMAProfessorAdminApiRequest(
              new Request(
                'https://ma-code.pt/api/admin/ma-professor/requests/approve-plan',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':
                      'application/json'
                  },
                  body: JSON.stringify({
                    email: professor,
                    approvalPlan
                  })
                }
              ),
              {
                RESEND_API_KEY_MA_PROFESSOR:
                  'test-key'
              }
            )

          const body = await response.json()

          assert.equal(
            body.approvalPlan,
            approvalPlan
          )
          assert.equal(
            body.emailDelivery,
            'sent'
          )
          assert.equal(
            body.credentialIssued,
            true
          )
          assert.equal(hooks.generated, 1)
          assert.equal(calls.length, 1)
          assert.deepEqual(
            readPayload(calls[0]).to,
            [professor]
          )
        }
      )
    }
  )
}

test(
  'email architecture has one Resend transport and no configurable admin override',
  () => {
    assert.doesNotMatch(
      notifierSource,
      /MA_PROFESSOR_ADMIN_EMAIL/
    )
    assert.doesNotMatch(
      notifierSource,
      /api\.resend\.com/
    )
    assert.doesNotMatch(
      pilotSource,
      /api\.resend\.com/
    )
    assert.doesNotMatch(
      fixedSource,
      /api\.resend\.com/
    )
    assert.match(
      serviceSource,
      /api\.resend\.com\/emails/
    )
    assert.match(
      pilotSource,
      /sendMAProfessorPilotApprovalEmail/
    )
    assert.match(
      pilotSource,
      /sendMAProfessorPilotRejectionEmail/
    )
    assert.match(
      fixedSource,
      /sendMAProfessorCommercialActivationEmail/
    )
    assert.match(
      fixedSource,
      /sendMAProfessorPilotApprovalEmail/
    )
  }
)
