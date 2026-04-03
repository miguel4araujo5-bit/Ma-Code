export interface Env {
  WEB3FORMS_KEY: string
}

type ContactBody = {
  name?: string
  email?: string
  message?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname !== '/api/contact') {
      return new Response('Not Found', { status: 404 })
    }

    if (request.method !== 'POST') {
      return json({ success: false, message: 'Método não permitido.' }, 405)
    }

    try {
      const body = (await request.json()) as ContactBody

      const name = body.name?.trim() || ''
      const email = body.email?.trim() || ''
      const message = body.message?.trim() || ''

      if (!name || !email || !message) {
        return json({ success: false, message: 'Preencha todos os campos.' }, 400)
      }

      const web3Response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          access_key: env.WEB3FORMS_KEY,
          subject: 'Pedido de orçamento - MA-Code',
          from_name: 'MA-Code Website',
          name,
          email,
          message
        })
      })

      const data = await web3Response.json<{
        success?: boolean
        message?: string
      }>()

      if (!web3Response.ok || !data.success) {
        return json(
          {
            success: false,
            message: data.message || 'Erro ao enviar pedido.'
          },
          400
        )
      }

      return json({
        success: true,
        message: 'Pedido enviado com sucesso.'
      })
    } catch {
      return json(
        {
          success: false,
          message: 'Erro interno ao processar o pedido.'
        },
        500
      )
    }
  }
}
