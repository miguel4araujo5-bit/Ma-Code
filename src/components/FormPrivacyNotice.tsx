type FormPrivacyNoticeProps = {
  className?: string
  privacyHref?: string
}

export default function FormPrivacyNotice({
  className = "",
  privacyHref,
}: FormPrivacyNoticeProps) {
  return (
    <div
      aria-label="Informação sobre privacidade do formulário"
      className={[
        "rounded-2xl border border-sky-400/15 bg-slate-950/35 px-4 py-3 text-xs leading-relaxed text-slate-300",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p>
        Os dados enviados neste formulário são tratados pela MA-Code apenas para
        responder ao seu pedido de contacto, preparar uma proposta ou dar
        seguimento à comunicação iniciada por si.
      </p>

      <p className="mt-2">
        Não usamos estes dados para marketing automático nem os vendemos a
        terceiros. Pode pedir acesso, correção ou apagamento dos seus dados
        através dos contactos da MA-Code
        {privacyHref ? (
          <>
            {" "}
            ou consultar a{" "}
            <a
              href={privacyHref}
              className="font-semibold text-sky-200 underline decoration-sky-300/50 underline-offset-4 transition hover:text-white"
            >
              Política de Privacidade
            </a>
          </>
        ) : null}
        .
      </p>
    </div>
  )
}
