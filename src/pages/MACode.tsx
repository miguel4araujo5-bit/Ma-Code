import { useState } from 'react'

export default function MACode() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [isSending, setIsSending] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSending(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          access_key: '18547eb2-4deb-4420-b33d-64813f8918e5',
          subject: 'Pedido de orçamento - MA-Code',
          from_name: 'MA-Code Website',
          name: form.name,
          email: form.email,
          message: form.message
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao enviar pedido')
      }

      setSuccessMessage('Pedido enviado com sucesso. Entraremos em contacto em breve.')
      setForm({
        name: '',
        email: '',
        message: ''
      })
    } catch {
      setErrorMessage('Não foi possível enviar o pedido. Tente novamente.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-paper px-6 pb-32 pt-40">
      <div className="mx-auto mb-24 max-w-5xl text-center">
        <h1 className="mb-6 text-6xl font-serif">
          MA-Code
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-stone-600">
          Criamos websites e aplicações modernas para empresas que querem
          uma presença digital profissional e eficiente.
          <span className="font-bold"> (A partir de 19€/mês)</span>
        </p>
      </div>

      <div className="mx-auto mb-32 grid max-w-5xl gap-12 md:grid-cols-3">
        <div className="border border-stone-200 p-8 text-center">
          <h3 className="mb-4 text-xl font-serif">
            Websites Profissionais
          </h3>

          <p className="text-stone-600">
            Websites rápidos, modernos e otimizados para telemóvel.
          </p>
        </div>

        <div className="border border-stone-200 p-8 text-center">
          <h3 className="mb-4 text-xl font-serif">
            Sistemas de Marcação
          </h3>

          <p className="text-stone-600">
            Sistemas de reservas online para salões, clínicas e serviços.
          </p>
        </div>

        <div className="border border-stone-200 p-8 text-center">
          <h3 className="mb-4 text-xl font-serif">
            Aplicações Web
          </h3>

          <p className="text-stone-600">
            Plataformas personalizadas para automatizar o seu negócio.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-center text-4xl font-serif">
          Pedir Orçamento
        </h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="input-label">
              Nome
            </label>

            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="input-label">
              Email
            </label>

            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="input-label">
              Descreva o projeto
            </label>

            <textarea
              className="input-field h-32 resize-none"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
            />
          </div>

          {successMessage ? (
            <div className="border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSending}
          >
            {isSending ? 'A enviar...' : 'Pedir orçamento'}
          </button>
        </form>
      </div>
    </div>
  )
}
