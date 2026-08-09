import type {
    MAProfessorCommercialPlan,
    MAProfessorCommercialStatusResponse
} from './accessApi';

import type {
    MAProfessorAccessRequestStatus
} from './accessTypes';

export type MAProfessorEntryMode =
    | 'request'
    | 'request-sent'
    | 'activate';

interface AccessEntryScreenProps {
    mode: MAProfessorEntryMode;
    email: string;
    password: string;
    selectedPlan:
        | MAProfessorCommercialPlan
        | null;
    requestStatus:
        | MAProfessorAccessRequestStatus
        | null;
    message: string;
    error: string;
    submitting: boolean;
    commercialStatus:
        | MAProfessorCommercialStatusResponse
        | null;
    commercialLoading: boolean;
    onEmailChange: (
        value: string
    ) => void;
    onPasswordChange: (
        value: string
    ) => void;
    onPlanChange: (
        plan: MAProfessorCommercialPlan
    ) => void;
    onRequest: () => void;
    onActivate: () => void;
    onShowRequest: () => void;
    onShowActivate: () => void;
    onRefreshStatus: () => void;
}

function getPlanLabel(
    plan:
        | MAProfessorCommercialPlan
        | null
) {
    if (
        plan === 'paid_30_days'
    ) {
        return '3,49 € / 30 dias';
    }

    if (
        plan === 'school_year'
    ) {
        return '15 € / até 1 de agosto';
    }

    return 'Plano por escolher';
}

function formatAmount(
    amountCents: number | null
) {
    if (
        amountCents === null
    ) {
        return '—';
    }

    return new Intl.NumberFormat(
        'pt-PT',
        {
            style: 'currency',
            currency: 'EUR'
        }
    ).format(
        amountCents / 100
    );
}

function StatusBadge({
    status
}: {
    status:
        | MAProfessorAccessRequestStatus
        | null;
}) {
    if (!status) {
        return null;
    }

    const label =
        status === 'approved'
            ? 'Pedido aprovado'
            : status ===
                'rejected'
              ? 'Pedido rejeitado'
              : 'A aguardar aprovação';

    const className =
        status === 'approved'
            ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
            : status ===
                'rejected'
              ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
              : 'border-amber-300/20 bg-amber-300/10 text-amber-100';

    return (
        <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${className}`}
        >
            {label}
        </span>
    );
}

function PlanButtons({
    disabled,
    selectedPlan,
    onSelectPlan
}: {
    disabled: boolean;
    selectedPlan:
        | MAProfessorCommercialPlan
        | null;
    onSelectPlan: (
        plan: MAProfessorCommercialPlan
    ) => void;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <button
                type="button"
                disabled={disabled}
                onClick={() =>
                    onSelectPlan(
                        'paid_30_days'
                    )
                }
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                    selectedPlan ===
                    'paid_30_days'
                        ? 'border-cyan-300/60 bg-cyan-300/15 ring-2 ring-cyan-300/10'
                        : 'border-white/10 bg-slate-950/60 hover:border-cyan-300/30 hover:bg-cyan-300/5'
                }`}
            >
                <span className="block text-lg font-black text-cyan-200">
                    3,49 €
                </span>
                <span className="mt-1 block text-sm font-bold text-white">
                    30 dias
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-400">
                    Renovação manual.
                    Cada novo período
                    autorizado terá uma
                    nova senha.
                </span>
            </button>

            <button
                type="button"
                disabled={disabled}
                onClick={() =>
                    onSelectPlan(
                        'school_year'
                    )
                }
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                    selectedPlan ===
                    'school_year'
                        ? 'border-violet-300/60 bg-violet-300/15 ring-2 ring-violet-300/10'
                        : 'border-white/10 bg-slate-950/60 hover:border-violet-300/30 hover:bg-violet-300/5'
                }`}
            >
                <span className="block text-lg font-black text-violet-200">
                    15 €
                </span>
                <span className="mt-1 block text-sm font-bold text-white">
                    Até 1 de agosto
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-400">
                    Sem ativações mensais
                    enquanto a licença do
                    ano letivo estiver
                    válida.
                </span>
            </button>
        </div>
    );
}

function PaymentInstructions({
    selectedPlan
}: {
    selectedPlan:
        | MAProfessorCommercialPlan
        | null;
}) {
    if (!selectedPlan) {
        return null;
    }

    return (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-sm font-black text-white">
                Pagamento por MB WAY
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
                Plano selecionado:{' '}
                <strong className="text-white">
                    {getPlanLabel(
                        selectedPlan
                    )}
                </strong>
                . No fluxo normal,
                efetue o pagamento antes
                de enviar o pedido,
                segundo as instruções
                fornecidas pela MA-CODE.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
                Se ainda não recebeu as
                instruções de pagamento,
                contacte
                {' '}
                <span className="font-semibold text-slate-300">
                    acesso@ma-code.pt
                </span>
                . Ignore o pagamento
                apenas se recebeu uma
                indicação direta da
                MA-CODE para o fazer.
            </p>
        </div>
    );
}

function CommercialFlow({
    requestStatus,
    commercialStatus,
    commercialLoading,
    onRefreshStatus,
    onShowActivate
}: {
    requestStatus:
        | MAProfessorAccessRequestStatus
        | null;
    commercialStatus:
        | MAProfessorCommercialStatusResponse
        | null;
    commercialLoading: boolean;
    onRefreshStatus: () => void;
    onShowActivate: () => void;
}) {
    if (
        requestStatus === 'rejected'
    ) {
        return (
            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100">
                Este pedido não está
                aprovado. Se considerar
                que existe um erro,
                contacte a MA-CODE.
            </div>
        );
    }

    if (!commercialStatus) {
        return (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                <p className="text-sm font-black text-amber-100">
                    A verificar a
                    autorização comercial.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                    O plano foi escolhido
                    antes do pedido. Use
                    este botão para
                    consultar o estado da
                    aprovação, do
                    pagamento e da senha.
                </p>
                <button
                    type="button"
                    disabled={
                        commercialLoading
                    }
                    onClick={
                        onRefreshStatus
                    }
                    className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
                >
                    {commercialLoading
                        ? 'A verificar…'
                        : 'Verificar estado'}
                </button>
            </div>
        );
    }

    if (
        commercialStatus.existingLicense
    ) {
        return (
            <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <p className="text-sm font-black text-cyan-100">
                    Esta conta já tem uma
                    licença associada.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                    Se já recebeu a sua
                    senha, pode entrar.
                    As renovações são
                    tratadas a partir da
                    licença existente.
                </p>
                <button
                    type="button"
                    onClick={
                        onShowActivate
                    }
                    className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                >
                    Ativar ou entrar
                </button>
            </div>
        );
    }

    const paymentResolved =
        commercialStatus.paymentStatus ===
            'confirmed' ||
        commercialStatus.paymentStatus ===
            'dispensed';

    if (
        commercialStatus.canActivate ||
        commercialStatus
            .credentialIssuedAt
    ) {
        return (
            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-sm font-black text-emerald-100">
                    Autorização validada e
                    senha emitida.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                    Introduza a senha
                    enviada pela MA-CODE
                    para ativar o plano{' '}
                    {getPlanLabel(
                        commercialStatus.plan
                    )}
                    .
                </p>
                <button
                    type="button"
                    onClick={
                        onShowActivate
                    }
                    className="mt-4 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-200"
                >
                    Introduzir senha
                </button>
            </div>
        );
    }

    if (paymentResolved) {
        return (
            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-sm font-black text-emerald-100">
                    {commercialStatus.paymentStatus ===
                    'dispensed'
                        ? 'Pagamento dispensado pela MA-CODE.'
                        : 'Pagamento confirmado.'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                    A autorização já pode
                    originar a nova senha.
                    Quando a receber por
                    email, volte aqui para
                    ativar.
                </p>
                <button
                    type="button"
                    disabled={
                        commercialLoading
                    }
                    onClick={
                        onRefreshStatus
                    }
                    className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
                >
                    {commercialLoading
                        ? 'A verificar…'
                        : 'Verificar novamente'}
                </button>
            </div>
        );
    }

    if (commercialStatus.plan) {
        return (
            <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                        Plano do pedido
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                        {getPlanLabel(
                            commercialStatus.plan
                        )}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                        Valor:{' '}
                        <strong className="text-white">
                            {formatAmount(
                                commercialStatus.amountCents
                            )}
                        </strong>
                    </p>
                </div>

                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <p className="text-sm font-black text-amber-100">
                        Pagamento pendente
                        de verificação.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                        A MA-CODE ainda
                        precisa de validar
                        o pedido e o
                        recebimento do
                        pagamento. A senha
                        só pode ser gerada
                        depois de o pedido
                        estar aprovado e o
                        pagamento estar
                        confirmado ou
                        dispensado.
                    </p>
                </div>

                <button
                    type="button"
                    disabled={
                        commercialLoading
                    }
                    onClick={
                        onRefreshStatus
                    }
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
                >
                    {commercialLoading
                        ? 'A verificar…'
                        : 'Verificar estado'}
                </button>
            </div>
        );
    }

    return (
        <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4">
            <p className="text-sm font-black text-rose-100">
                Não foi possível localizar
                o plano associado ao
                pedido.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
                Não envie um segundo
                pedido. Atualize o estado
                ou contacte a MA-CODE.
            </p>
            <button
                type="button"
                disabled={
                    commercialLoading
                }
                onClick={
                    onRefreshStatus
                }
                className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
            >
                {commercialLoading
                    ? 'A verificar…'
                    : 'Verificar estado'}
            </button>
        </div>
    );
}

export function AccessEntryScreen({
    mode,
    email,
    password,
    selectedPlan,
    requestStatus,
    message,
    error,
    submitting,
    commercialStatus,
    commercialLoading,
    onEmailChange,
    onPasswordChange,
    onPlanChange,
    onRequest,
    onActivate,
    onShowRequest,
    onShowActivate,
    onRefreshStatus
}: AccessEntryScreenProps) {
    return (
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
            <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-cyan-950/30 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                        MA-CODE · Acesso
                        privado
                    </p>
                    <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                        O seu ano letivo
                        num único lugar.
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                        Sumários, aulas,
                        turmas, avaliações,
                        faltas,
                        planificações e
                        horários, com os
                        dados guardados
                        neste dispositivo e
                        cópias de segurança
                        controladas por si.
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {[
                            'Configuração guiada e simples',
                            'Avaliações por UFCD ou módulo',
                            'Controlo de faltas e recuperações',
                            'Exportação e restauro de dados'
                        ].map(item => (
                            <div
                                key={item}
                                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-200"
                            >
                                <span className="mr-2 text-cyan-300">
                                    ✓
                                </span>
                                {item}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                                Mensal
                            </p>
                            <p className="mt-2 text-lg font-black text-white">
                                3,49 € / 30
                                dias
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                                Renovação
                                manual e sem
                                cobranças
                                automáticas.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                                Ano letivo
                            </p>
                            <p className="mt-2 text-lg font-black text-white">
                                15 €
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                                Válido até 1
                                de agosto do
                                respetivo ano
                                letivo.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-xs leading-5 text-slate-400">
                        Fluxo de acesso:
                        plano → email →
                        pagamento → pedido
                        → validação MA-CODE
                        → aprovação +
                        pagamento confirmado
                        ou dispensado → nova
                        senha → ativação.
                    </div>
                </div>

                <div className="p-7 sm:p-10">
                    {mode ===
                    'request' ? (
                        <form
                            onSubmit={event => {
                                event.preventDefault();
                                onRequest();
                            }}
                        >
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                Pedido de
                                acesso
                            </p>
                            <h2 className="mt-3 text-2xl font-black">
                                Escolha o
                                plano
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                                O plano é
                                escolhido por
                                si antes do
                                pedido e fica
                                associado ao
                                seu email e à
                                autorização
                                comercial.
                            </p>

                            <div className="mt-6">
                                <PlanButtons
                                    disabled={
                                        submitting
                                    }
                                    selectedPlan={
                                        selectedPlan
                                    }
                                    onSelectPlan={
                                        onPlanChange
                                    }
                                />
                            </div>

                            <label className="mt-6 block text-sm font-bold text-slate-200">
                                Email
                                <input
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={event =>
                                        onEmailChange(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="professor@escola.pt"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                                />
                            </label>

                            <PaymentInstructions
                                selectedPlan={
                                    selectedPlan
                                }
                            />

                            {message ? (
                                <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm leading-6 text-cyan-100">
                                    {message}
                                </p>
                            ) : null}

                            {error ? (
                                <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
                                    {error}
                                </p>
                            ) : null}

                            <button
                                type="submit"
                                disabled={
                                    submitting
                                }
                                className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                            >
                                {submitting
                                    ? 'A enviar…'
                                    : 'Enviar pedido para validação'}
                            </button>

                            <button
                                type="button"
                                onClick={
                                    onShowActivate
                                }
                                className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                            >
                                Já tenho a
                                senha
                            </button>
                        </form>
                    ) : null}

                    {mode ===
                    'request-sent' ? (
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                Estado do
                                acesso
                            </p>
                            <h2 className="mt-3 text-2xl font-black">
                                Pedido
                                registado
                            </h2>
                            <div className="mt-4">
                                <StatusBadge
                                    status={
                                        requestStatus
                                    }
                                />
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                {message ||
                                    'Pode voltar a esta área para acompanhar a validação do pedido, do pagamento e da nova senha.'}
                            </p>

                            <CommercialFlow
                                requestStatus={
                                    requestStatus
                                }
                                commercialStatus={
                                    commercialStatus
                                }
                                commercialLoading={
                                    commercialLoading
                                }
                                onRefreshStatus={
                                    onRefreshStatus
                                }
                                onShowActivate={
                                    onShowActivate
                                }
                            />

                            {error ? (
                                <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
                                    {error}
                                </p>
                            ) : null}

                            <button
                                type="button"
                                onClick={
                                    onShowRequest
                                }
                                className="mt-5 rounded-xl px-4 py-2 text-sm font-bold text-slate-500 transition hover:text-white"
                            >
                                Usar outro
                                email
                            </button>
                        </div>
                    ) : null}

                    {mode ===
                    'activate' ? (
                        <form
                            onSubmit={event => {
                                event.preventDefault();
                                onActivate();
                            }}
                        >
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                Ativação
                            </p>
                            <h2 className="mt-3 text-2xl font-black">
                                Ativar ou
                                entrar
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                                Use o mesmo
                                email do
                                pedido e a
                                nova senha
                                enviada pela
                                MA-CODE depois
                                de a
                                autorização
                                ter sido
                                validada.
                            </p>

                            <label className="mt-7 block text-sm font-bold text-slate-200">
                                Email
                                <input
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={event =>
                                        onEmailChange(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="professor@escola.pt"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                                />
                            </label>

                            <label className="mt-4 block text-sm font-bold text-slate-200">
                                Senha da
                                licença
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    value={
                                        password
                                    }
                                    onChange={event =>
                                        onPasswordChange(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Senha enviada pela MA-CODE"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                                />
                            </label>

                            {message ? (
                                <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm leading-6 text-cyan-100">
                                    {message}
                                </p>
                            ) : null}

                            {error ? (
                                <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
                                    {error}
                                </p>
                            ) : null}

                            <button
                                type="submit"
                                disabled={
                                    submitting
                                }
                                className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                            >
                                {submitting
                                    ? 'A validar…'
                                    : 'Ativar e entrar'}
                            </button>

                            <button
                                type="button"
                                onClick={
                                    onShowRequest
                                }
                                className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                            >
                                Ainda não
                                pedi acesso
                            </button>

                            <p className="mt-4 text-xs leading-5 text-slate-500">
                                A senha serve
                                para validar a
                                conta e a
                                autorização.
                                A chave de
                                recuperação
                                dos dados,
                                quando
                                utilizada, é
                                um mecanismo
                                separado.
                            </p>
                        </form>
                    ) : null}
                </div>
            </section>
        </main>
    );
}
