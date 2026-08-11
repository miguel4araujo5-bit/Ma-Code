interface ProductIntroPanelProps {
    onRequestAccess: () => void;
    onExistingAccess: () => void;
}

const managementAreas = [
    {
        title: 'Planificações',
        description:
            'Organize conteúdos, objetivos e sequência de trabalho.'
    },
    {
        title: 'Turmas e alunos',
        description:
            'Mantenha a informação essencial das suas turmas num só lugar.'
    },
    {
        title: 'Sumários e aulas',
        description:
            'Prepare, guarde e reutilize sumários no contexto de cada aula.'
    },
    {
        title: 'Avaliação',
        description:
            'Registe avaliações e acompanhe resultados por UFCD ou módulo.'
    },
    {
        title: 'Assiduidade',
        description:
            'Acompanhe faltas e identifique rapidamente situações de atenção.'
    },
    {
        title: 'Horário e calendário',
        description:
            'Consulte aulas, horários e organização do trabalho letivo.'
    }
];

const accessSteps = [
    {
        number: '1',
        title: 'Submeter pedido',
        description:
            'O docente solicita acesso ao MA-Professor através do seu email.'
    },
    {
        number: '2',
        title: 'Receber confirmação',
        description:
            'O pedido é analisado e a decisão é comunicada por email.'
    },
    {
        number: '3',
        title: 'Começar a utilizar',
        description:
            'Após aprovação, o docente recebe as instruções necessárias para aceder ao MA-Professor.'
    }
];

const faqs = [
    {
        question: 'Como funciona a fase piloto?',
        answer:
            'O acesso é gratuito e atribuído de forma limitada para permitir acompanhar a estabilidade da plataforma e a experiência dos docentes durante esta fase.'
    },
    {
        question: 'Como é gerida a disponibilidade de vagas?',
        answer:
            'Os pedidos são analisados pela MA-CODE. Quando não existir disponibilidade imediata, o pedido pode permanecer em espera até existir uma vaga.'
    },
    {
        question: 'Em que consiste a confirmação mensal?',
        answer:
            'Será solicitada periodicamente uma confirmação de que pretende continuar a utilizar a vaga atribuída.'
    },
    {
        question: 'O que acontece se não confirmar a utilização?',
        answer:
            'A ausência de confirmação implicará a desativação do acesso e a libertação da vaga para outro docente interessado.'
    },
    {
        question: 'Como são tratados os meus dados?',
        answer:
            'O MA-Professor mantém uma arquitetura local-first: os dados de trabalho diário permanecem no seu dispositivo, com mecanismos complementares de cópia e recuperação quando aplicável.'
    },
    {
        question: 'O que é o Apoio Fundador?',
        answer:
            'É uma modalidade opcional para quem pretenda apoiar o desenvolvimento e obter prioridade no acesso durante a fase piloto. A opção gratuita mantém-se disponível através da lista de espera.'
    }
];

export function ProductIntroPanel({
    onRequestAccess,
    onExistingAccess
}: ProductIntroPanelProps) {
    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
                <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-cyan-950/30">
                    <div className="relative overflow-hidden px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-cyan-400/10 to-transparent" />

                        <div className="relative max-w-4xl">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                                    MA-CODE · Fase piloto
                                </span>
                                <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                                    Acesso gratuito · vagas limitadas
                                </span>
                            </div>

                            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                                MA-Professor
                            </h1>

                            <p className="mt-5 max-w-3xl text-xl font-bold leading-8 text-slate-200 sm:text-2xl">
                                Ambiente digital para organização do trabalho docente, do planeamento à avaliação.
                            </p>

                            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                                Uma plataforma desenvolvida para apoiar os docentes na organização do trabalho diário, reunindo num único ambiente ferramentas de planeamento, gestão de turmas, sumários, assiduidade e avaliação.
                            </p>
                        </div>

                        <div className="relative mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-5 sm:p-6">
                            <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">
                                Fase piloto
                            </p>
                            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-200 sm:text-base">
                                O MA-Professor encontra-se em fase piloto com acesso gratuito e vagas limitadas, de modo a garantir a estabilidade da plataforma e o acompanhamento dos utilizadores.
                            </p>
                            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
                                Os docentes interessados poderão submeter um pedido de acesso. A decisão será comunicada por email.
                            </p>
                        </div>

                        <div className="relative mt-7 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={onRequestAccess}
                                className="rounded-2xl bg-cyan-300 px-6 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-300/20"
                            >
                                Pedir acesso
                            </button>

                            <button
                                type="button"
                                onClick={onExistingAccess}
                                className="rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-black text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] focus:outline-none focus:ring-4 focus:ring-white/10"
                            >
                                Já tenho acesso
                            </button>
                        </div>
                    </div>
                </section>

                <section className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 sm:p-8 lg:p-10">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                        O que pode gerir
                    </p>
                    <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                        O essencial do trabalho docente, mais organizado.
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                        O objetivo é reduzir dispersão e tarefas repetitivas, mantendo próximas as áreas que fazem parte do trabalho diário de um professor.
                    </p>

                    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {managementAreas.map(area => (
                            <article
                                key={area.title}
                                className="rounded-2xl border border-white/10 bg-slate-950/45 p-5"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] text-sm font-black text-cyan-200">
                                    ✓
                                </div>
                                <h3 className="mt-4 text-base font-black text-white">
                                    {area.title}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                    {area.description}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 sm:p-8 lg:p-10">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                        Como funciona o acesso
                    </p>
                    <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                        Um processo simples, em três passos.
                    </h2>

                    <div className="mt-7 grid gap-4 lg:grid-cols-3">
                        {accessSteps.map(step => (
                            <article
                                key={step.number}
                                className="rounded-2xl border border-white/10 bg-slate-950/45 p-5"
                            >
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-300 text-sm font-black text-slate-950">
                                    {step.number}
                                </span>
                                <h3 className="mt-4 text-base font-black text-white">
                                    {step.title}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                    {step.description}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 grid gap-6 lg:grid-cols-2">
                    <article className="rounded-[2rem] border border-amber-300/15 bg-amber-300/[0.04] p-6 sm:p-8">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                            Manutenção do acesso
                        </p>
                        <h2 className="mt-3 text-2xl font-black">
                            A vaga acompanha a utilização.
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-slate-300">
                            Para efeitos de manutenção do acesso, será solicitada uma confirmação mensal.
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-400">
                            A ausência de confirmação implicará a desativação do acesso e a consequente libertação da vaga.
                        </p>
                    </article>

                    <article className="rounded-[2rem] border border-violet-300/15 bg-violet-300/[0.04] p-6 sm:p-8">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                            Apoio Fundador
                        </p>
                        <h2 className="mt-3 text-2xl font-black">
                            Apoiar o desenvolvimento, com prioridade no acesso.
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-slate-300">
                            Existe a possibilidade de Apoio Fundador, que confere prioridade no acesso durante a fase piloto.
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-400">
                            Esta modalidade destina-se a quem pretenda apoiar o desenvolvimento. A opção gratuita mantém-se disponível através da lista de espera.
                        </p>
                    </article>
                </section>

                <section className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 sm:p-8 lg:p-10">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Perguntas frequentes
                    </p>
                    <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                        Antes de pedir acesso
                    </h2>

                    <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-slate-950/40 px-5 sm:px-6">
                        {faqs.map(item => (
                            <details
                                key={item.question}
                                className="group py-5"
                            >
                                <summary className="cursor-pointer list-none pr-8 text-sm font-black text-slate-200 marker:hidden">
                                    {item.question}
                                </summary>
                                <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                                    {item.answer}
                                </p>
                            </details>
                        ))}
                    </div>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={onRequestAccess}
                            className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
                        >
                            Pedir acesso
                        </button>
                        <button
                            type="button"
                            onClick={onExistingAccess}
                            className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-black text-slate-300 transition hover:bg-white/5 hover:text-white"
                        >
                            Já tenho acesso
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
