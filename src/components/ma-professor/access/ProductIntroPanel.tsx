interface ProductIntroPanelProps {
    onRequestAccess: () => void;
    onExistingAccess: () => void;
}

const managementAreas = [
    {
        title: 'Planificações',
        description:
            'Organize conteúdos, objetivos e a sequência de trabalho de cada UFCD ou módulo.'
    },
    {
        title: 'Turmas e alunos',
        description:
            'Tenha a informação essencial das suas turmas e alunos sempre acessível.'
    },
    {
        title: 'Sumários e aulas',
        description:
            'Prepare, guarde e reutilize sumários diretamente no contexto de cada aula.'
    },
    {
        title: 'Avaliação',
        description:
            'Registe avaliações e acompanhe a evolução dos alunos por UFCD ou módulo.'
    },
    {
        title: 'Assiduidade',
        description:
            'Registe faltas e identifique rapidamente alunos que exigem maior atenção.'
    },
    {
        title: 'Horário e calendário',
        description:
            'Acompanhe aulas, horários e organização do trabalho letivo num único espaço.'
    }
];

const accessSteps = [
    {
        number: '1',
        title: 'Pedir acesso',
        description:
            'Indique o seu email e submeta o pedido para participar na fase piloto.'
    },
    {
        number: '2',
        title: 'Receber a decisão',
        description:
            'Analisamos o pedido e comunicamos a decisão diretamente por email.'
    },
    {
        number: '3',
        title: 'Começar a utilizar',
        description:
            'Se o acesso for aprovado, recebe as instruções necessárias para entrar no MA-Professor.'
    }
];

const faqs = [
    {
        question: 'Como funciona a fase piloto?',
        answer:
            'Nesta fase, o acesso ao MA-Professor é gratuito e limitado a um grupo de docentes. O objetivo é acompanhar a utilização real da plataforma, garantir estabilidade e continuar a melhorá-la antes de uma disponibilização mais ampla.'
    },
    {
        question: 'Como é gerida a disponibilidade de vagas?',
        answer:
            'Os pedidos são analisados pela MA-CODE. Se não existir uma vaga disponível no momento, o pedido pode ficar em espera até surgir nova disponibilidade.'
    },
    {
        question: 'Em que consiste a confirmação mensal?',
        answer:
            'Uma vez por mês será solicitada uma confirmação simples de que pretende continuar a utilizar o MA-Professor. Isto ajuda-nos a manter as vagas disponíveis para docentes que estão efetivamente a utilizar a plataforma.'
    },
    {
        question: 'O que acontece se não confirmar a utilização?',
        answer:
            'Se não existir confirmação, o acesso poderá ser desativado e a vaga libertada para outro docente. Os dados locais não são eliminados por essa desativação.'
    },
    {
        question: 'Como são tratados os meus dados?',
        answer:
            'O MA-Professor foi concebido com uma abordagem local-first. A informação do trabalho docente permanece prioritariamente no seu dispositivo, com mecanismos complementares de cópia e recuperação quando aplicável.'
    },
    {
        question: 'O que é o Apoio Fundador?',
        answer:
            'É uma opção para quem queira apoiar o desenvolvimento do MA-Professor e ter prioridade no acesso durante a fase piloto. O pedido de acesso gratuito continua disponível para todos os docentes.'
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
                                Menos tempo a organizar. Mais foco no trabalho docente.
                            </p>

                            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                                Um ambiente digital pensado para reunir o trabalho que acompanha cada professor ao longo do dia: planificações, aulas, turmas, sumários, assiduidade e avaliação — de forma simples e organizada.
                            </p>
                        </div>

                        <div className="relative mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-5 sm:p-6">
                            <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">
                                Fase piloto
                            </p>

                            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-200 sm:text-base">
                                Estamos a abrir o MA-Professor a um grupo limitado de docentes. Durante esta fase, o acesso é gratuito e as vagas são limitadas, permitindo-nos acompanhar de perto a utilização e continuar a melhorar a plataforma.
                            </p>

                            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
                                Se gostaria de experimentar o MA-Professor no seu dia a dia, pode submeter um pedido de acesso. A decisão será comunicada por email.
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
                        O trabalho docente mais organizado, num só lugar.
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                        O MA-Professor aproxima as tarefas que fazem parte do seu dia a dia para reduzir a dispersão entre ficheiros, notas e diferentes ferramentas.
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
                        Experimente o MA-Professor durante a fase piloto.
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                        O acesso é feito mediante pedido para conseguirmos acompanhar esta fase com proximidade e manter uma boa experiência para os docentes participantes.
                    </p>

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
                            Queremos que cada vaga seja realmente utilizada.
                        </h2>

                        <p className="mt-4 text-sm leading-7 text-slate-300">
                            Durante a fase piloto, será solicitada uma confirmação mensal simples para sabermos que pretende continuar a utilizar o MA-Professor.
                        </p>

                        <p className="mt-2 text-sm leading-7 text-slate-400">
                            Se não existir confirmação, o acesso poderá ser desativado e a vaga disponibilizada a outro docente interessado.
                        </p>
                    </article>

                    <article className="rounded-[2rem] border border-violet-300/15 bg-violet-300/[0.04] p-6 sm:p-8">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                            Apoio Fundador
                        </p>

                        <h2 className="mt-3 text-2xl font-black">
                            Para quem quiser apoiar o projeto desde o início.
                        </h2>

                        <p className="mt-4 text-sm leading-7 text-slate-300">
                            Quem pretenda contribuir para o desenvolvimento do MA-Professor poderá optar pelo Apoio Fundador, com prioridade no acesso durante a fase piloto.
                        </p>

                        <p className="mt-2 text-sm leading-7 text-slate-400">
                            É uma opção inteiramente voluntária. O acesso gratuito mantém-se disponível para todos os docentes através do pedido de acesso.
                        </p>
                    </article>
                </section>

                <section className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 sm:p-8 lg:p-10">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Perguntas frequentes
                    </p>

                    <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                        O que precisa de saber antes de começar
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
