import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    getMAProfessorSyncStatus,
    type MAProfessorSyncStatus
} from '../sync/syncApi';
import {
    activateMAProfessorAccess,
    endMAProfessorSession,
    requestMAProfessorAccess,
    requestMAProfessorRenewal,
    verifyMAProfessorAccess
} from './accessApi';

import {
    AccessEntryScreen,
    type MAProfessorEntryMode
} from './AccessEntryScreen';
import {
    clearMAProfessorAccessSession,
    getOrCreateMAProfessorDeviceId,
    readMAProfessorAccessSession,
    saveMAProfessorAccessSession
} from './accessStorage';

import {
    getLicensePlanLabel,
    getLicenseStatusLabel,
    isLicenseUsable,
    type MAProfessorAccessRequestStatus,
    type MAProfessorAccessSession,
    type RenewableLicensePlan
} from './accessTypes';

interface AccessContextValue {
    session: MAProfessorAccessSession;
    refreshing: boolean;
    syncStatus:
        | MAProfessorSyncStatus
        | null;
    syncChecking: boolean;
    syncError: string;
    refresh: () => Promise<void>;
    refreshSyncStatus: () => Promise<void>;
    requestRenewal: (
        plan: RenewableLicensePlan
    ) => Promise<string>;
    signOut: () => Promise<void>;
}

const AccessContext =
    createContext<AccessContextValue | null>(
        null
    );

function normalizeEmail(
    value: string
) {
    return value
        .trim()
        .toLowerCase();
}

function isValidEmail(
    value: string
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value
    );
}

function getErrorMessage(
    error: unknown
) {
    return error instanceof Error
        ? error.message
        : 'Ocorreu um erro inesperado.';
}

function formatDate(
    value: string | null
) {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(
        'pt-PT',
        {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }
    ).format(
        new Date(value)
    );
}

function getRequestMessage(
    status: MAProfessorAccessRequestStatus
) {
    if (
        status === 'approved'
    ) {
        return 'O pedido foi aprovado. Consulte o email enviado pela MA-CODE com as instruções necessárias para aceder ao MA-Professor.';
    }

    if (
        status === 'rejected'
    ) {
        return 'O pedido não foi aprovado. Se necessitar de esclarecimentos, contacte a MA-CODE.';
    }

    return 'O pedido foi recebido e está em análise. A decisão será comunicada por email.';
}

export function useMAProfessorAccess() {
    const context =
        useContext(AccessContext);

    if (!context) {
        throw new Error(
            'useMAProfessorAccess deve ser utilizado dentro de AccessGate.'
        );
    }

    return context;
}

export function AccessGate({
    children
}: {
    children: ReactNode;
}) {
    const [
        session,
        setSession
    ] =
        useState<MAProfessorAccessSession | null>(
            null
        );

    const [
        loading,
        setLoading
    ] = useState(true);

    const [
        refreshing,
        setRefreshing
    ] = useState(false);

    const [
        mode,
        setMode
    ] =
        useState<MAProfessorEntryMode>(
            'intro'
        );

    const [
        email,
        setEmail
    ] = useState('');

    const [
        password,
        setPassword
    ] = useState('');

    const [
        requestStatus,
        setRequestStatus
    ] =
        useState<MAProfessorAccessRequestStatus | null>(
            null
        );

    const [
        entryMessage,
        setEntryMessage
    ] = useState('');

    const [
        error,
        setError
    ] = useState('');

    const [
        submitting,
        setSubmitting
    ] = useState(false);

    const [
        renewingPlan,
        setRenewingPlan
    ] =
        useState<RenewableLicensePlan | null>(
            null
        );

    const [
        syncStatus,
        setSyncStatus
    ] =
        useState<MAProfessorSyncStatus | null>(
            null
        );

    const [
        syncChecking,
        setSyncChecking
    ] = useState(false);

    const [
        syncError,
        setSyncError
    ] = useState('');

    const persistSession =
        useCallback(
            (
                nextSession: MAProfessorAccessSession
            ) => {
                setSession(
                    nextSession
                );

                saveMAProfessorAccessSession(
                    nextSession
                );
            },
            []
        );

    const checkSyncStatus =
        useCallback(
            async (
                targetSession: MAProfessorAccessSession
            ) => {
                setSyncChecking(true);
                setSyncError('');

                try {
                    const response =
                        await getMAProfessorSyncStatus(
                            targetSession.token,
                            targetSession.deviceId
                        );

                    setSyncStatus(
                        response
                    );
                } catch (
                    syncStatusError
                ) {
                    setSyncStatus(
                        null
                    );

                    setSyncError(
                        getErrorMessage(
                            syncStatusError
                        )
                    );
                } finally {
                    setSyncChecking(
                        false
                    );
                }
            },
            []
        );

    const verifyStoredSession =
        useCallback(async () => {
            const stored =
                readMAProfessorAccessSession();

            if (!stored) {
                setSession(null);
                setSyncStatus(null);
                setSyncError('');
                setLoading(false);
                return;
            }

            try {
                const response =
                    await verifyMAProfessorAccess(
                        stored.token,
                        stored.deviceId
                    );

                const nextSession: MAProfessorAccessSession =
                    {
                        ...stored,
                        email:
                            response
                                .license
                                .email,
                        license:
                            response
                                .license,
                        checkedAt:
                            new Date().toISOString()
                    };

                persistSession(
                    nextSession
                );

                if (
                    isLicenseUsable(
                        nextSession.license
                    )
                ) {
                    void checkSyncStatus(
                        nextSession
                    );
                } else {
                    setSyncStatus(
                        null
                    );
                    setSyncError('');
                }
            } catch {
                clearMAProfessorAccessSession();
                setSession(null);
                setSyncStatus(null);
                setSyncError('');
            } finally {
                setLoading(false);
            }
        }, [
            checkSyncStatus,
            persistSession
        ]);

    useEffect(() => {
        void verifyStoredSession();
    }, [
        verifyStoredSession
    ]);

    const refresh =
        useCallback(async () => {
            if (!session) {
                return;
            }

            setRefreshing(true);

            try {
                const response =
                    await verifyMAProfessorAccess(
                        session.token,
                        session.deviceId
                    );

                const nextSession: MAProfessorAccessSession =
                    {
                        ...session,
                        email:
                            response
                                .license
                                .email,
                        license:
                            response
                                .license,
                        checkedAt:
                            new Date().toISOString()
                    };

                persistSession(
                    nextSession
                );

                if (
                    isLicenseUsable(
                        nextSession.license
                    )
                ) {
                    void checkSyncStatus(
                        nextSession
                    );
                } else {
                    setSyncStatus(
                        null
                    );
                    setSyncError('');
                }
            } finally {
                setRefreshing(
                    false
                );
            }
        }, [
            checkSyncStatus,
            persistSession,
            session
        ]);

    const refreshSyncStatus =
        useCallback(async () => {
            if (!session) {
                setSyncStatus(
                    null
                );
                setSyncError('');
                return;
            }

            await checkSyncStatus(
                session
            );
        }, [
            checkSyncStatus,
            session
        ]);

    const requestRenewal =
        useCallback(
            async (
                plan: RenewableLicensePlan
            ) => {
                if (!session) {
                    throw new Error(
                        'A sessão já não está disponível.'
                    );
                }

                const response =
                    await requestMAProfessorRenewal(
                        session.token,
                        session.deviceId,
                        plan
                    );

                const nextSession: MAProfessorAccessSession =
                    {
                        ...session,
                        license:
                            response.license,
                        checkedAt:
                            new Date().toISOString()
                    };

                persistSession(
                    nextSession
                );

                if (
                    isLicenseUsable(
                        nextSession.license
                    )
                ) {
                    void checkSyncStatus(
                        nextSession
                    );
                }

                return response.message;
            },
            [
                checkSyncStatus,
                persistSession,
                session
            ]
        );

    const resetEntry =
        useCallback(() => {
            setMode('intro');
            setEmail('');
            setPassword('');
            setRequestStatus(null);
            setEntryMessage('');
            setError('');
        }, []);

    const signOut =
        useCallback(async () => {
            const current =
                session;

            clearMAProfessorAccessSession();
            setSession(null);
            setSyncStatus(null);
            setSyncError('');
            setSyncChecking(false);
            resetEntry();

            if (current) {
                try {
                    await endMAProfessorSession(
                        current.token,
                        current.deviceId
                    );
                } catch {
                    // A sessão local fica terminada mesmo que o servidor esteja indisponível.
                }
            }
        }, [
            resetEntry,
            session
        ]);

    const handleRequest =
        async () => {
            setError('');

            const normalizedEmail =
                normalizeEmail(
                    email
                );

            if (
                !isValidEmail(
                    normalizedEmail
                )
            ) {
                setError(
                    'Indique um email válido.'
                );
                return;
            }

            setSubmitting(true);

            try {
                const response =
                    await requestMAProfessorAccess(
                        normalizedEmail
                    );

                const status =
                    response.request.status;

                setEmail(
                    normalizedEmail
                );
                setRequestStatus(
                    status
                );
                setEntryMessage(
                    response.message ||
                        getRequestMessage(
                            status
                        )
                );
                setMode(
                    'request-sent'
                );
            } catch (
                requestError
            ) {
                setError(
                    getErrorMessage(
                        requestError
                    )
                );
            } finally {
                setSubmitting(
                    false
                );
            }
        };

    const handleRefreshEntryStatus =
        async () => {
            setError('');

            const normalizedEmail =
                normalizeEmail(
                    email
                );

            if (
                !isValidEmail(
                    normalizedEmail
                )
            ) {
                setError(
                    'Indique um email válido.'
                );
                return;
            }

            setSubmitting(true);

            try {
                const response =
                    await requestMAProfessorAccess(
                        normalizedEmail
                    );

                const status =
                    response.request.status;

                setEmail(
                    normalizedEmail
                );
                setRequestStatus(
                    status
                );
                setEntryMessage(
                    response.message ||
                        getRequestMessage(
                            status
                        )
                );
                setMode(
                    'request-sent'
                );
            } catch (
                statusError
            ) {
                setError(
                    getErrorMessage(
                        statusError
                    )
                );
            } finally {
                setSubmitting(
                    false
                );
            }
        };

    const handleActivate =
        async () => {
            setError('');

            const normalizedEmail =
                normalizeEmail(
                    email
                );

            const normalizedPassword =
                password.trim();

            if (
                !isValidEmail(
                    normalizedEmail
                )
            ) {
                setError(
                    'Indique um email válido.'
                );
                return;
            }

            if (
                !normalizedPassword
            ) {
                setError(
                    'Indique a senha recebida da MA-CODE.'
                );
                return;
            }

            setSubmitting(true);

            try {
                const deviceId =
                    getOrCreateMAProfessorDeviceId();

                const response =
                    await activateMAProfessorAccess(
                        normalizedEmail,
                        normalizedPassword,
                        deviceId
                    );

                const nextSession: MAProfessorAccessSession =
                    {
                        token:
                            response.token,
                        deviceId,
                        email:
                            response
                                .license
                                .email,
                        license:
                            response
                                .license,
                        checkedAt:
                            new Date().toISOString()
                    };

                setPassword('');
                setRequestStatus(null);
                setEntryMessage('');

                persistSession(
                    nextSession
                );

                if (
                    isLicenseUsable(
                        nextSession.license
                    )
                ) {
                    void checkSyncStatus(
                        nextSession
                    );
                }
            } catch (
                activationError
            ) {
                setError(
                    getErrorMessage(
                        activationError
                    )
                );
            } finally {
                setSubmitting(
                    false
                );
            }
        };

    const handleRenewFromGate =
        async (
            plan: RenewableLicensePlan
        ) => {
            setError('');
            setRenewingPlan(plan);

            try {
                await requestRenewal(
                    plan
                );
            } catch (
                renewalError
            ) {
                setError(
                    getErrorMessage(
                        renewalError
                    )
                );
            } finally {
                setRenewingPlan(
                    null
                );
            }
        };

    const contextValue =
        useMemo<AccessContextValue | null>(
            () =>
                session
                    ? {
                          session,
                          refreshing,
                          syncStatus,
                          syncChecking,
                          syncError,
                          refresh,
                          refreshSyncStatus,
                          requestRenewal,
                          signOut
                      }
                    : null,
            [
                refresh,
                refreshing,
                refreshSyncStatus,
                requestRenewal,
                session,
                signOut,
                syncChecking,
                syncError,
                syncStatus
            ]
        );

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
                    <p className="mt-4 text-sm font-semibold text-slate-400">
                        A verificar o acesso
                        ao MA-Professor…
                    </p>
                </div>
            </main>
        );
    }

    if (!session) {
        return (
            <AccessEntryScreen
                mode={mode}
                email={email}
                password={password}
                requestStatus={
                    requestStatus
                }
                message={
                    entryMessage
                }
                error={error}
                submitting={
                    submitting
                }
                onEmailChange={value => {
                    setEmail(value);
                    setError('');
                }}
                onPasswordChange={value => {
                    setPassword(
                        value
                    );
                    setError('');
                }}
                onRequest={() =>
                    void handleRequest()
                }
                onActivate={() =>
                    void handleActivate()
                }
                onShowIntro={() => {
                    setMode(
                        'intro'
                    );
                    setPassword('');
                    setError('');
                }}
                onShowRequest={() => {
                    setMode(
                        'request'
                    );
                    setPassword('');
                    setRequestStatus(
                        null
                    );
                    setEntryMessage('');
                    setError('');
                }}
                onShowActivate={() => {
                    setMode(
                        'activate'
                    );
                    setPassword('');
                    setError('');
                }}
                onRefreshStatus={() =>
                    void handleRefreshEntryStatus()
                }
            />
        );
    }

    const isPilotPhaseLicense =
        session.license.plan ===
            'beta_30_days' ||
        session.license.plan ===
            'courtesy_30_days' ||
        session.license.plan ===
            'courtesy_school_year';

    if (
        !isLicenseUsable(
            session.license
        )
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white sm:px-6">
                <section className="w-full max-w-2xl rounded-[2rem] border border-amber-300/20 bg-slate-900 p-7 shadow-2xl sm:p-10">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                        Licença{' '}
                        {getLicenseStatusLabel(
                            session
                                .license
                                .status
                        )}
                    </p>
                    <h1 className="mt-3 text-3xl font-black">
                        {isPilotPhaseLicense
                            ? 'O acesso piloto está inativo.'
                            : 'O período de acesso terminou.'}
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                        {isPilotPhaseLicense ? (
                            <>
                                O acesso associado a esta vaga deixou de estar ativo em{' '}
                                <strong className="text-white">
                                    {formatDate(
                                        session
                                            .license
                                            .validUntil
                                    )}
                                </strong>
                                . Os seus dados continuam guardados neste dispositivo.
                            </>
                        ) : (
                            <>
                                O plano{' '}
                                {getLicensePlanLabel(
                                    session
                                        .license
                                        .plan
                                )}{' '}
                                terminou em{' '}
                                <strong className="text-white">
                                    {formatDate(
                                        session
                                            .license
                                            .validUntil
                                    )}
                                </strong>
                                . Os seus dados continuam guardados neste dispositivo.
                            </>
                        )}
                    </p>

                    {isPilotPhaseLicense ? (
                        <div className="mt-7 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5">
                            <p className="text-sm font-black text-cyan-100">
                                Fase piloto
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                                Durante a fase piloto, a manutenção da vaga depende da confirmação periódica de utilização. Consulte o email associado à conta para verificar se existe alguma ação pendente.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mt-7 grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    disabled={Boolean(
                                        renewingPlan
                                    )}
                                    onClick={() =>
                                        void handleRenewFromGate(
                                            'paid_30_days'
                                        )
                                    }
                                    className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 text-left transition hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
                                >
                                    <span className="block text-base font-black text-cyan-200">
                                        3,49 € / 30 dias
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-400">
                                        Renovação manual · sem renovação automática
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    disabled={Boolean(
                                        renewingPlan
                                    )}
                                    onClick={() =>
                                        void handleRenewFromGate(
                                            'school_year'
                                        )
                                    }
                                    className="rounded-2xl border border-violet-300/30 bg-violet-300/10 px-5 py-4 text-left transition hover:bg-violet-300/15 disabled:cursor-wait disabled:opacity-60"
                                >
                                    <span className="block text-base font-black text-violet-200">
                                        15 €
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-400">
                                        Até 1 de agosto do respetivo ano letivo
                                    </span>
                                </button>
                            </div>

                            <p className="mt-4 text-xs leading-5 text-slate-500">
                                O pagamento e a renovação são confirmados manualmente pela MA-CODE nesta fase.
                            </p>
                        </>
                    )}

                    {error ? (
                        <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">
                            {error}
                        </p>
                    ) : null}

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() =>
                                void refresh()
                            }
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/5"
                        >
                            Verificar
                            novamente
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                void signOut()
                            }
                            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-white"
                        >
                            Usar outro email
                        </button>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <AccessContext.Provider
            value={
                contextValue
            }
        >
            {children}
        </AccessContext.Provider>
    );
}
