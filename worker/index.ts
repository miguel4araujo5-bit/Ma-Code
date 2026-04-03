export interface Env {
  WEB3FORMS_KEY?: string
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

    if (!env.WEB3FORMS_KEY) {
      return json(
        {
          success: false,
          message: 'WEB3FORMS_KEY não encontrada no Worker.'
        },
        500
      )
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
          access_key: '18547eb2-4deb-4420-b33d-64813f8918e5',
          subject: 'Pedido de orçamento - MA-Code',
          from_name: 'MA-Code Website',
          name,
          email,
          message
        })
      })

      const rawText = await web3Response.text()

      let data: { success?: boolean; message?: string } = {}

      try {
        data = JSON.parse(rawText)
      } catch {
        return json(
          {
            success: false,
            message: `Resposta inválida do Web3Forms: ${rawText || 'sem conteúdo'}`
          },
          502
        )
      }

      if (!web3Response.ok || !data.success) {
        return json(
          {
            success: false,
            message: data.message || `Web3Forms rejeitou o pedido (${web3Response.status}).`
          },
          400
        )
      }

      return json({
        success: true,
        message: 'Pedido enviado com sucesso.'
      })
    } catch (error) {
      return json(
        {
          success: false,
          message: error instanceof Error ? error.message : 'Erro interno ao processar o pedido.'
        },
        500
      )
    }
  }
}
