export interface Env {
  WEB3FORMS_ACCESS_KEY: string
}

type ContactBody = {
  name?: string
  email?: string
  message?: string
  phone?: string
  projectType?: string
  hasWebsite?: string
  botcheck?: string
}

type Web3FormsResponse = {
  success?: boolean
  message?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  })

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const cleanText = (value: string, maxLength: number) =>
  value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname !== '/api/contact') {
      return new Response('Not Found', { status: 404 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: 'POST, OPTIONS'
        }
      })
    }

    if (request.method !== 'POST') {
      return json({ success: false, message: 'Método não permitido.' }, 405)
    }

    if (!env.WEB3FORMS_ACCESS_KEY?.trim()) {
      return json(
        {
          success: false,
          message: 'A configuração do formulário não está disponível neste momento.'
        },
        500
      )
    }

    const contentLength = Number(request.headers.get('content-length') || 0)

    if (contentLength > 25_000) {
      return json(
        {
          success: false,
          message: 'O pedido é demasiado longo. Reduza a mensagem e tente novamente.'
        },
        413
      )
    }

    try {
      const body = (await request.json()) as ContactBody

      if (body.botcheck?.trim()) {
        return json({
          success: true,
          message: 'Pedido enviado com sucesso.'
        })
      }

      const name = cleanText(body.name || '', 120)
      const email = cleanText(body.email || '', 180).toLowerCase()
      const phone = cleanText(body.phone || '', 80)
      const projectType = cleanText(body.projectType || '', 120)
      const hasWebsite = cleanText(body.hasWebsite || '', 120)
      const message = cleanText(body.message || '', 5000)

      if (!name || !email || !message) {
        return json({ success: false, message: 'Preencha todos os campos obrigatórios.' }, 400)
      }

      if (name.length < 2) {
        return json({ success: false, message: 'Indique um nome válido.' }, 400)
      }

      if (!isValidEmail(email)) {
        return json({ success: false, message: 'Indique um email válido.' }, 400)
      }

      if (message.length < 10) {
        return json(
          {
            success: false,
            message: 'Descreva o projeto com um pouco mais de detalhe.'
          },
          400
        )
      }

      const fullMessage = [
        projectType ? `Tipo de projeto: ${projectType}` : null,
        hasWebsite ? `Já tem site: ${hasWebsite}` : null,
        phone ? `Telefone/WhatsApp: ${phone}` : null,
        '',
        'Mensagem:',
        message
      ]
        .filter((line) => line !== null)
        .join('\n')

      const web3Response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          access_key: env.WEB3FORMS_ACCESS_KEY,
          subject: 'Pedido de orçamento - MA-Code',
          from_name: 'MA-Code Website',
          name,
          email,
          replyto: email,
          phone,
          project_type: projectType,
          has_website: hasWebsite,
          message: fullMessage,
          page: url.origin,
          timestamp: new Date().toISOString()
        })
      })

      let data: Web3FormsResponse = {}

      try {
        data = (await web3Response.json()) as Web3FormsResponse
      } catch {
        return json(
          {
            success: false,
            message: 'Não foi possível confirmar o envio do formulário. Tente novamente.'
          },
          502
        )
      }

      if (!web3Response.ok || !data.success) {
        return json(
          {
            success: false,
            message: data.message || 'Não foi possível enviar o pedido. Tente novamente.'
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
          message: 'Erro interno ao processar o pedido. Tente novamente.'
        },
        500
      )
    }
  }
}
