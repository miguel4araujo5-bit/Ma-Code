import type { ReactNode } from 'react';

import type {
    MAProfessorAccessRequestStatus
} from './accessTypes';

import {
    ProductIntroPanel
} from './ProductIntroPanel';

export type MAProfessorEntryMode =
    | 'intro'
    | 'request'
    | 'request-sent'
    | 'activate';

interface AccessEntryScreenProps {
    mode: MAProfessorEntryMode;
    email: string;
    password: string;
    requestStatus:
        | MAProfessorAccessRequestStatus
        | null;
    message: string;
    error: string;
    submitting: boolean;
    onEmailChange: (
        value: string
    ) => void;
    onPasswordChange: (
        value: string
    ) => void;
    onRequest: () => void;
    onActivate: () => void;
    onShowIntro: () => void;
    onShowRequest: () => void;
    onShowActivate: () => void;
    onRefreshStatus: () => void;
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
              ? 'Pedido não aprovado'
              : 'Pedido em análise';

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

function EntryShell({
    eyebrow,
    title,
    description,
    children,
    onBack
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    onBack: () => void;
}) {
    return (
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
            <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-cyan-950/30">
                <div className="border-b border-white/10 p-7 sm:p-10">
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition hover:text-cyan-200"
                    >
                        ← Voltar ao MA-Professor
                    </button>

                    <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                        {eyebrow}
                    </p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                        {title}
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                        {description}
                    </p>
                </div>

                <div className="p-7 sm:p-10">
                    {children}
                </div>
            </section>
        </main>
    );
}

export function AccessEntryScreen({
    mode,
    email,
    password,
    requestStatus,
    message,
    error,
    submitting,
    onEmailChange,
    onPasswordChange,
    onRequest,
    onActivate,
    onShowIntro,
    onShowRequest,
    onShowActivate,
    onRefreshStatus
}: AccessEntryScreenProps) {
    if (mode === 'intro') {
        return (
            <ProductIntroPanel
                onRequestAccess={
                    onShowRequest
                }
                onExistingAccess={
                    onShowActivate
                }
            />
        );
    }

    if (mode === 'request') {
        return (
            <EntryShell
                eyebrow="Fase piloto · Pedido de acesso"
                title="Pedir acesso ao MA-Professor"
                description="O acesso durante a fase piloto é gratuito e está sujeito à disponibilidade de vagas. Envie o seu email para que o pedido possa ser analisado pela MA-CODE."
                onBack={onShowIntro}
            >
                <form
                    onSubmit={event => {
                        event.preventDefault();
                        onRequest();
                    }}
                >
                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                        <p className="text-sm font-black text-cyan-100">
                            Acesso gratuito · vagas limitadas
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            O pedido será analisado e a decisão será comunicada por email. O envio do pedido não garante atribuição imediata de uma vaga.
                        </p>
                    </div>

                    <label className="mt-6 block text-sm font-bold text-slate-200">
                        Email
                        <input
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={event =>
                                onEmailChange(
                                    event.target.value
                                )
                            }
                            placeholder="professor@escola.pt"
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
                        disabled={submitting}
                        className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                    >
                        {submitting
                            ? 'A enviar pedido…'
                            : 'Submeter pedido de acesso'}
                    </button>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">
                            Já recebeu acesso?
                        </span>
                        <button
                            type="button"
                            onClick={onShowActivate}
                            className="font-black text-cyan-200 transition hover:text-cyan-100"
                        >
                            Já tenho acesso
                        </button>
                    </div>
                </form>
            </EntryShell>
        );
    }

    if (mode === 'request-sent') {
        return (
            <EntryShell
                eyebrow="Fase piloto · Estado do pedido"
                title="Pedido de acesso"
                description="Acompanhe aqui o estado básico do seu pedido. A decisão oficial e as instruções de acesso serão comunicadas por email."
                onBack={onShowIntro}
            >
                <StatusBadge
                    status={requestStatus}
                />

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Email do pedido
                    </p>
                    <p className="mt-2 break-all text-sm font-black text-white">
                        {email}
                    </p>

                    {message ? (
                        <p className="mt-4 text-sm leading-7 text-slate-300">
                            {message}
                        </p>
                    ) : null}
                </div>

                {requestStatus === 'pending' ? (
                    <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                        <p className="text-sm font-black text-amber-100">
                            O pedido está em análise.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                            Não é necessário enviar outro pedido. A decisão será comunicada para o email indicado.
                        </p>
                    </div>
                ) : null}

                {requestStatus === 'approved' ? (
                    <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                        <p className="text-sm font-black text-emerald-100">
                            Pedido aprovado.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            Se já recebeu a senha de acesso por email, pode utilizá-la para entrar no MA-Professor.
                        </p>
                    </div>
                ) : null}

                {requestStatus === 'rejected' ? (
                    <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4">
                        <p className="text-sm font-black text-rose-100">
                            O pedido não foi aprovado.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                            Se necessitar de esclarecimentos, contacte a MA-CODE através dos canais habituais.
                        </p>
                    </div>
                ) : null}

                {error ? (
                    <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
                        {error}
                    </p>
                ) : null}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {requestStatus === 'approved' ? (
                        <button
                            type="button"
                            onClick={onShowActivate}
                            className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-200"
                        >
                            Introduzir senha
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={onRefreshStatus}
                            className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.07] px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
                        >
                            {submitting
                                ? 'A verificar…'
                                : 'Verificar estado'}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onShowActivate}
                        className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                        Já tenho acesso
                    </button>
                </div>
            </EntryShell>
        );
    }

    return (
        <EntryShell
            eyebrow="MA-Professor · Acesso"
            title="Já tenho acesso"
            description="Introduza o email associado ao seu acesso e a senha recebida da MA-CODE. Na primeira utilização válida será criado o período de acesso autorizado."
            onBack={onShowIntro}
        >
            <form
                onSubmit={event => {
                    event.preventDefault();
                    onActivate();
                }}
            >
                <label className="block text-sm font-bold text-slate-200">
                    Email
                    <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={event =>
                            onEmailChange(
                                event.target.value
                            )
                        }
                        placeholder="professor@escola.pt"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                    />
                </label>

                <label className="mt-5 block text-sm font-bold text-slate-200">
                    Senha de acesso
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={event =>
                            onPasswordChange(
                                event.target.value
                            )
                        }
                        placeholder="Senha recebida por email"
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
                    disabled={submitting}
                    className="mt-6 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                >
                    {submitting
                        ? 'A entrar…'
                        : 'Entrar no MA-Professor'}
                </button>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">
                        Ainda não tem acesso?
                    </span>
                    <button
                        type="button"
                        onClick={onShowRequest}
                        className="font-black text-cyan-200 transition hover:text-cyan-100"
                    >
                        Pedir acesso
                    </button>
                </div>
            </form>
        </EntryShell>
    );
}
