import {
    MaProfessorAccessDurableObject as BaseMaProfessorAccessDurableObject,
    type LicensePlan,
    type LicenseStatus
} from './maProfessorAccess';

const STORAGE_KEY = 'ma-professor-access-state-v1';
const COMMERCE_STORAGE_KEY = 'ma-professor-admin-commerce-v1';

const PUBLIC_ACCESS_REQUEST_PATH =
    '/api/ma-professor/access/request';
const PUBLIC_ACCESS_ACTIVATE_PATH =
    '/api/ma-professor/access/activate';
const PUBLIC_ACCESS_RENEW_PATH =
    '/api/ma-professor/access/renew';
const PUBLIC_COMMERCE_STATUS_PATH =
    '/api/ma-professor/access/commerce/status';
const PUBLIC_COMMERCE_SELECT_PLAN_PATH =
    '/api/ma-professor/access/commerce/select-plan';

const PAID_30_DAYS = 30;
const EXPIRING_DAYS = 7;

export type MAProfessorPaidPlan =
    | 'paid_30_days'
    | 'school_year';

interface StoredLicenseSnapshot {
    email: string;
    plan: LicensePlan;
    validFrom: number;
    validUntil: number;
    revokedAt: number | null;
    renewalRequestedAt: number | null;
    renewalRequestedPlan: LicensePlan | null;
    deviceIds: string[];
    createdAt: number;
    updatedAt: number;
}

interface StoredAccessRequestSnapshot {
    email: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt?: number | null;
    approvedAt?: number | null;
    rejectedAt?: number | null;
    activatedAt: number | null;
    updatedAt: number;
}

interface StoredAccessCredentialSnapshot {
    email: string;
    authorizationId?: string;
    authorizationPlan?: MAProfessorPaidPlan;
}

interface StoredRenewalRequestSnapshot {
    id: string;
    email: string;
    requestedPlan: MAProfessorPaidPlan;
    amountCents: number;
    currency: 'EUR';
    status:
        | 'pending'
        | 'approved'
        | 'rejected'
        | 'cancelled';
    requestedAt: number;
    resolvedAt?: number | null;
    updatedAt?: number;
}

interface AccessStateSnapshot {
    licenses?: Record<string, StoredLicenseSnapshot>;
    renewals?: StoredRenewalRequestSnapshot[];
    accessRequests?: Record<string, StoredAccessRequestSnapshot>;
    credentials?: Record<string, StoredAccessCredentialSnapshot>;
    updatedAt?: number;
    [key: string]: unknown;
}

interface StoredCommercialAuthorization {
    id: string;
    email: string;
    plan: MAProfessorPaidPlan;
    amountCents: number;
    currency: 'EUR';
    selectedAt: number;
    renewalId?: string | null;
    paymentConfirmedAt: number | null;
    paymentDispensedAt?: number | null;
    credentialIssuedAt: number | null;
    activatedAt?: number | null;
    createdAt: number;
    updatedAt: number;
}

interface StoredCommerceState {
    schemaVersion: 1;
    authorizations: StoredCommercialAuthorization[];
    createdAt: number;
    updatedAt: number;
}

interface DurableObjectStorageLike {
    get<T>(key: string): Promise<T | undefined>;

    put<T>(
        key: string,
        value: T
    ): Promise<void>;

    put(
        entries: Record<string, unknown>
    ): Promise<void>;
}

interface DurableObjectStateLike {
    storage: DurableObjectStorageLike;
}

type JsonObject = Record<string, unknown>;

interface PaidAccessContext {
    state: DurableObjectStateLike;
    base: BaseMaProfessorAccessDurableObject;
    refreshBase: () => void;
}

const securityHeaders: Record<string, string> = {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'Content-Security-Policy':
        "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow'
};

function json(
    body: unknown,
    status = 200
) {
    return new Response(
        JSON.stringify(body),
        {
            status,
            headers: {
                'Content-Type':
                    'application/json; charset=utf-8',
                ...securityHeaders
            }
        }
    );
}

function normalizeEmail(
    value: unknown
) {
    return typeof value === 'string'
        ? value
              .trim()
              .toLowerCase()
              .slice(0, 180)
        : '';
}

function isValidEmail(
    value: string
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value
    );
}

function isPaidPlan(
    value: unknown
): value is MAProfessorPaidPlan {
    return (
        value === 'paid_30_days' ||
        value === 'school_year'
    );
}

function getPlanAmountCents(
    plan: MAProfessorPaidPlan
) {
    return plan === 'paid_30_days'
        ? 349
        : 1500;
}

function addDays(
    timestamp: number,
    days: number
) {
    return (
        timestamp +
        days *
            24 *
            60 *
            60 *
            1000
    );
}

function getSchoolYearValidUntil(
    validFrom: number
) {
    const activationDate =
        new Date(validFrom);

    const activationYear =
        activationDate.getUTCFullYear();

    /*
     * Fim de 1 de agosto em Portugal continental.
     * Em agosto, Portugal continental está em UTC+1.
     */
    const cutoffThisYear =
        Date.UTC(
            activationYear,
            7,
            1,
            22,
            59,
            59,
            999
        );

    if (validFrom <= cutoffThisYear) {
        return cutoffThisYear;
    }

    return Date.UTC(
        activationYear + 1,
        7,
        1,
        22,
        59,
        59,
        999
    );
}

function getDaysRemaining(
    validUntil: number,
    now: number
) {
    return Math.max(
        0,
        Math.ceil(
            (validUntil - now) /
                (24 *
                    60 *
                    60 *
                    1000)
        )
    );
}

function getLicenseStatus(
    license: StoredLicenseSnapshot,
    now: number
): LicenseStatus {
    if (
        license.revokedAt !== null
    ) {
        return 'revoked';
    }

    if (
        license.validUntil <= now
    ) {
        return 'expired';
    }

    if (
        getDaysRemaining(
            license.validUntil,
            now
        ) <= EXPIRING_DAYS
    ) {
        return 'expiring';
    }

    return 'active';
}

function buildLicenseSummary(
    license: StoredLicenseSnapshot,
    now: number
) {
    return {
        email: license.email,
        plan: license.plan,
        status: getLicenseStatus(
            license,
            now
        ),
        validFrom: new Date(
            license.validFrom
        ).toISOString(),
        validUntil: new Date(
            license.validUntil
        ).toISOString(),
        daysRemaining: getDaysRemaining(
            license.validUntil,
            now
        ),
        renewalRequestedAt:
            license
                .renewalRequestedAt ===
            null
                ? null
                : new Date(
                      license.renewalRequestedAt
                  ).toISOString()
    };
}

function createEmptyCommerceState(
    now: number
): StoredCommerceState {
    return {
        schemaVersion: 1,
        authorizations: [],
        createdAt: now,
        updatedAt: now
    };
}

function normalizeAuthorization(
    authorization: StoredCommercialAuthorization
): StoredCommercialAuthorization {
    return {
        ...authorization,
        renewalId:
            authorization.renewalId ??
            null,
        paymentDispensedAt:
            authorization.paymentDispensedAt ??
            null,
        activatedAt:
            authorization.activatedAt ??
            null
    };
}

function normalizeCommerceState(
    value:
        | StoredCommerceState
        | undefined,
    now: number
): StoredCommerceState {
    if (
        !value ||
        value.schemaVersion !== 1 ||
        !Array.isArray(
            value.authorizations
        )
    ) {
        return createEmptyCommerceState(
            now
        );
    }

    return {
        ...value,
        authorizations:
            value.authorizations.map(
                normalizeAuthorization
            )
    };
}

function getLatestAuthorization(
    commerceState: StoredCommerceState,
    email: string
) {
    return (
        commerceState.authorizations
            .filter(
                authorization =>
                    authorization.email ===
                    email
            )
            .sort(
                (left, right) =>
                    right.createdAt -
                    left.createdAt
            )[0] || null
    );
}

function getAuthorizationForRenewal(
    commerceState: StoredCommerceState,
    renewalId: string
) {
    return (
        commerceState.authorizations.find(
            authorization =>
                authorization.renewalId ===
                renewalId
        ) || null
    );
}

function isPaymentResolved(
    authorization:
        | StoredCommercialAuthorization
        | null
) {
    return Boolean(
        authorization &&
            (authorization.paymentConfirmedAt !==
                null ||
                authorization.paymentDispensedAt !==
                    null)
    );
}

function getPaymentStatus(
    authorization:
        | StoredCommercialAuthorization
        | null
) {
    if (!authorization) {
        return 'not_started' as const;
    }

    if (
        authorization.paymentDispensedAt !==
        null &&
        authorization.paymentDispensedAt !==
        undefined
    ) {
        return 'dispensed' as const;
    }

    return authorization
        .paymentConfirmedAt === null
        ? ('pending' as const)
        : ('confirmed' as const);
}

function buildCommercialStatus(
    email: string,
    accessState:
        | AccessStateSnapshot
        | undefined,
    authorization:
        | StoredCommercialAuthorization
        | null
) {
    const accessRequest =
        accessState
            ?.accessRequests?.[email];

    const existingLicense =
        Boolean(
            accessState
                ?.licenses?.[email]
        );

    const requestStatus =
        accessRequest?.status || null;

    const authorizationReady =
        Boolean(
            authorization &&
                isPaymentResolved(
                    authorization
                ) &&
                authorization
                    .credentialIssuedAt !==
                    null &&
                authorization
                    .activatedAt ===
                    null
        );

    const canActivate =
        requestStatus === 'approved' &&
        authorizationReady &&
        (!existingLicense ||
            Boolean(
                authorization?.renewalId
            ));

    return {
        success: true as const,
        email,
        requestStatus,
        existingLicense,
        authorizationId:
            authorization?.id || null,
        plan:
            authorization?.plan || null,
        amountCents:
            authorization
                ?.amountCents ?? null,
        currency: 'EUR' as const,
        paymentStatus:
            getPaymentStatus(
                authorization
            ),
        selectedAt: authorization
            ? new Date(
                  authorization.selectedAt
              ).toISOString()
            : null,
        paymentConfirmedAt:
            authorization
                ?.paymentConfirmedAt ===
                null ||
            authorization
                ?.paymentConfirmedAt ===
                undefined
                ? null
                : new Date(
                      authorization.paymentConfirmedAt
                  ).toISOString(),
        paymentDispensedAt:
            authorization
                ?.paymentDispensedAt ===
                null ||
            authorization
                ?.paymentDispensedAt ===
                undefined
                ? null
                : new Date(
                      authorization.paymentDispensedAt
                  ).toISOString(),
        credentialIssuedAt:
            authorization
                ?.credentialIssuedAt ===
                null ||
            authorization
                ?.credentialIssuedAt ===
                undefined
                ? null
                : new Date(
                      authorization.credentialIssuedAt
                  ).toISOString(),
        canSelectPlan: false,
        canActivate
    };
}

async function readJsonBody(
    request: Request
): Promise<JsonObject | null> {
    try {
        const parsed =
            await request
                .clone()
                .json();

        if (
            !parsed ||
            typeof parsed !==
                'object' ||
            Array.isArray(parsed)
        ) {
            return null;
        }

        return parsed as JsonObject;
    } catch {
        return null;
    }
}

function readLicenseEmailFromResponse(
    body: JsonObject
) {
    const license =
        body.license;

    if (
        !license ||
        typeof license !== 'object' ||
        Array.isArray(license)
    ) {
        return '';
    }

    return normalizeEmail(
        (license as JsonObject).email
    );
}

async function handlePaidAccessRequest(
    request: Request,
    context: PaidAccessContext
): Promise<Response> {
    if (
        request.method !== 'POST'
    ) {
        return json(
            {
                success: false,
                message:
                    'Método não permitido.'
            },
            405
        );
    }

    const body =
        await readJsonBody(request);

    const email = normalizeEmail(
        body?.email
    );

    const plan = body?.plan;

    if (!isValidEmail(email)) {
        return json(
            {
                success: false,
                message:
                    'Indique um email válido.'
            },
            400
        );
    }

    if (!isPaidPlan(plan)) {
        return json(
            {
                success: false,
                message:
                    'Escolha o plano antes de enviar o pedido de acesso.'
            },
            400
        );
    }

    const beforeState =
        await context.state.storage.get<AccessStateSnapshot>(
            STORAGE_KEY
        );

    if (
        beforeState?.licenses?.[email]
    ) {
        return context.base.fetch(
            request
        );
    }

    const existingRequest =
        beforeState
            ?.accessRequests?.[email];

    if (
        existingRequest?.status ===
        'rejected'
    ) {
        return context.base.fetch(
            request
        );
    }

    const now = Date.now();

    const storedCommerceState =
        await context.state.storage.get<StoredCommerceState>(
            COMMERCE_STORAGE_KEY
        );

    const commerceState =
        normalizeCommerceState(
            storedCommerceState,
            now
        );

    const latestAuthorization =
        getLatestAuthorization(
            commerceState,
            email
        );

    if (
        latestAuthorization &&
        !latestAuthorization.renewalId &&
        latestAuthorization.plan !==
            plan
    ) {
        return json(
            {
                success: false,
                message:
                    'Este pedido já está associado a outro plano. Para alterar o plano, contacte a MA-CODE antes de efetuar uma nova autorização.'
            },
            409
        );
    }

    const baseResponse =
        await context.base.fetch(
            request
        );

    if (!baseResponse.ok) {
        return baseResponse;
    }

    const afterState =
        await context.state.storage.get<AccessStateSnapshot>(
            STORAGE_KEY
        );

    const accessRequest =
        afterState
            ?.accessRequests?.[email];

    if (
        !accessRequest ||
        accessRequest.status ===
            'rejected' ||
        afterState?.licenses?.[email]
    ) {
        return baseResponse;
    }

    let authorization =
        latestAuthorization &&
        !latestAuthorization.renewalId
            ? latestAuthorization
            : null;

    if (!authorization) {
        authorization = {
            id: crypto.randomUUID(),
            email,
            plan,
            amountCents:
                getPlanAmountCents(
                    plan
                ),
            currency: 'EUR',
            selectedAt: now,
            renewalId: null,
            paymentConfirmedAt: null,
            paymentDispensedAt: null,
            credentialIssuedAt: null,
            activatedAt: null,
            createdAt: now,
            updatedAt: now
        };

        commerceState.authorizations.push(
            authorization
        );

        commerceState.updatedAt = now;

        await context.state.storage.put(
            COMMERCE_STORAGE_KEY,
            commerceState
        );
    }

    let responseBody: JsonObject = {};

    try {
        responseBody =
            (await baseResponse
                .clone()
                .json()) as JsonObject;
    } catch {
        responseBody = {};
    }

    return json({
        ...responseBody,
        success: true,
        commerce:
            buildCommercialStatus(
                email,
                afterState,
                authorization
            )
    });
}

async function handlePaidRenewal(
    request: Request,
    context: PaidAccessContext
): Promise<Response> {
    if (
        request.method !== 'POST'
    ) {
        return json(
            {
                success: false,
                message:
                    'Método não permitido.'
            },
            405
        );
    }

    const body =
        await readJsonBody(request);

    const requestedPlan =
        body?.requestedPlan;

    /*
     * A validação completa de sessão, dispositivo
     * e plano continua a pertencer ao motor base.
     */
    if (!isPaidPlan(requestedPlan)) {
        return context.base.fetch(
            request
        );
    }

    const baseResponse =
        await context.base.fetch(
            request
        );

    if (!baseResponse.ok) {
        return baseResponse;
    }

    let responseBody: JsonObject = {};

    try {
        responseBody =
            (await baseResponse
                .clone()
                .json()) as JsonObject;
    } catch {
        return baseResponse;
    }

    const email =
        readLicenseEmailFromResponse(
            responseBody
        );

    if (!isValidEmail(email)) {
        return baseResponse;
    }

    const accessState =
        await context.state.storage.get<AccessStateSnapshot>(
            STORAGE_KEY
        );

    if (!accessState) {
        return baseResponse;
    }

    /*
     * O motor base cria a renovação antes de chegarmos
     * aqui. Procuramos exatamente a renovação pendente
     * mais recente para esta conta e para o plano pedido.
     *
     * Se o utilizador repetir o pedido dentro da janela
     * de proteção do motor base, reutilizamos a mesma
     * renovação e não criamos outra autorização.
     */
    const renewal =
        [...(accessState.renewals || [])]
            .filter(
                item =>
                    item.email === email &&
                    item.requestedPlan ===
                        requestedPlan &&
                    item.status ===
                        'pending'
            )
            .sort(
                (left, right) =>
                    right.requestedAt -
                    left.requestedAt
            )[0] || null;

    if (!renewal) {
        return baseResponse;
    }

    const now = Date.now();

    const storedCommerceState =
        await context.state.storage.get<StoredCommerceState>(
            COMMERCE_STORAGE_KEY
        );

    const commerceState =
        normalizeCommerceState(
            storedCommerceState,
            now
        );

    let authorization =
        getAuthorizationForRenewal(
            commerceState,
            renewal.id
        );

    if (!authorization) {
        /*
         * Se existir um pedido de renovação anterior
         * que ficou abandonado, o novo pedido passa
         * a ser o atual e o anterior deixa de ficar
         * eternamente pendente.
         */
        for (
            const existingRenewal of
            accessState.renewals || []
        ) {
            if (
                existingRenewal.email ===
                    email &&
                existingRenewal.id !==
                    renewal.id &&
                existingRenewal.status ===
                    'pending'
            ) {
                existingRenewal.status =
                    'cancelled';

                existingRenewal.resolvedAt =
                    now;

                existingRenewal.updatedAt =
                    now;
            }
        }

        authorization = {
            id: crypto.randomUUID(),
            email,
            plan: requestedPlan,
            amountCents:
                renewal.amountCents,
            currency:
                renewal.currency,
            selectedAt:
                renewal.requestedAt,
            renewalId:
                renewal.id,
            paymentConfirmedAt: null,
            paymentDispensedAt: null,
            credentialIssuedAt: null,
            activatedAt: null,
            createdAt: now,
            updatedAt: now
        };

        commerceState.authorizations.push(
            authorization
        );

        commerceState.updatedAt =
            now;

        accessState.updatedAt =
            now;

        await context.state.storage.put({
            [STORAGE_KEY]:
                accessState,

            [COMMERCE_STORAGE_KEY]:
                commerceState
        });

        /*
         * O motor base mantém estado em memória.
         * Depois de alterarmos diretamente o storage,
         * recriamo-lo para não continuar com uma cópia
         * antiga da renovação.
         */
        context.refreshBase();
    }

    return json({
        ...responseBody,
        success: true,
        commerce:
            buildCommercialStatus(
                email,
                accessState,
                authorization
            ),
        message:
            'Pedido de renovação registado. O novo plano ficou associado a uma nova autorização e o pagamento está pendente de verificação pela MA-CODE.'
    });
}

async function handleCommercialStatus(
    request: Request,
    context: PaidAccessContext
) {
    if (
        request.method !== 'POST'
    ) {
        return json(
            {
                success: false,
                message:
                    'Método não permitido.'
            },
            405
        );
    }

    const body =
        await readJsonBody(request);

    const email =
        normalizeEmail(
            body?.email
        );

    if (!isValidEmail(email)) {
        return json(
            {
                success: false,
                message:
                    'Indique um email válido.'
            },
            400
        );
    }

    const [
        accessState,
        storedCommerceState
    ] = await Promise.all([
        context.state.storage.get<AccessStateSnapshot>(
            STORAGE_KEY
        ),

        context.state.storage.get<StoredCommerceState>(
            COMMERCE_STORAGE_KEY
        )
    ]);

    const commerceState =
        normalizeCommerceState(
            storedCommerceState,
            Date.now()
        );

    const authorization =
        getLatestAuthorization(
            commerceState,
            email
        );

    return json(
        buildCommercialStatus(
            email,
            accessState,
            authorization
        )
    );
}

async function handleLegacyPlanSelection() {
    return json(
        {
            success: false,
            message:
                'O plano é agora escolhido pelo professor antes de enviar o pedido de acesso. Esta operação já não está disponível na área pública.'
        },
        409
    );
}

async function handlePaidActivation(
    request: Request,
    context: PaidAccessContext
): Promise<Response | null> {
    if (
        request.method !== 'POST'
    ) {
        return null;
    }

    const body =
        await readJsonBody(request);

    if (!body) {
        return null;
    }

    const email =
        normalizeEmail(
            body.email
        );

    if (!isValidEmail(email)) {
        return null;
    }

    const accessState =
        await context.state.storage.get<AccessStateSnapshot>(
            STORAGE_KEY
        );

    const accessRequest =
        accessState
            ?.accessRequests?.[email];

    if (
        !accessState ||
        !accessRequest ||
        accessRequest.status !==
            'approved'
    ) {
        return null;
    }

    const storedCommerceState =
        await context.state.storage.get<StoredCommerceState>(
            COMMERCE_STORAGE_KEY
        );

    const commerceState =
        normalizeCommerceState(
            storedCommerceState,
            Date.now()
        );

    const authorization =
        getLatestAuthorization(
            commerceState,
            email
        );

    if (!authorization) {
        /*
         * Contas antigas que já tenham licença podem
         * continuar a iniciar sessão através do motor
         * base mesmo que não tenham metadata comercial.
         */
        if (
            accessState
                .licenses?.[email]
        ) {
            return null;
        }

        return json(
            {
                success: false,
                message:
                    'Ainda não existe uma autorização comercial associada a esta conta.'
            },
            409
        );
    }

    /*
     * REGRA CRÍTICA:
     *
     * Uma autorização já ativada nunca volta a alterar
     * a validade da licença.
     *
     * Sem esta proteção, reutilizar a mesma senha de
     * renovação poderia voltar a iniciar outro período
     * de 30 dias. Depois da primeira ativação, a senha
     * passa apenas pelo fluxo normal de login.
     */
    if (
        authorization.activatedAt !==
        null &&
        authorization.activatedAt !==
        undefined
    ) {
        return null;
    }

    const existingLicense =
        accessState
            .licenses?.[email] ||
        null;

    /*
     * Uma conta que já tem licença só pode entrar neste
     * fluxo especial se a autorização comercial atual
     * estiver explicitamente ligada a uma renovação.
     *
     * Caso contrário trata-se apenas de um login normal.
     */
    if (
        existingLicense &&
        !authorization.renewalId
    ) {
        return null;
    }

    let renewal:
        | StoredRenewalRequestSnapshot
        | null = null;

    if (authorization.renewalId) {
        renewal =
            accessState.renewals?.find(
                item =>
                    item.id ===
                        authorization.renewalId &&
                    item.email ===
                        email
            ) || null;

        if (!renewal) {
            return json(
                {
                    success: false,
                    message:
                        'A renovação associada a esta senha já não foi encontrada. Contacte a MA-CODE.'
                },
                409
            );
        }

        if (
            renewal.status !==
            'pending'
        ) {
            return json(
                {
                    success: false,
                    message:
                        renewal.status ===
                        'approved'
                            ? 'Esta renovação já foi ativada.'
                            : 'Esta renovação já não está disponível para ativação.'
                },
                409
            );
        }
    }

    if (
        !isPaymentResolved(
            authorization
        )
    ) {
        return json(
            {
                success: false,
                message:
                    'O pagamento desta conta ainda está pendente de verificação pela MA-CODE.'
            },
            409
        );
    }

    if (
        authorization
            .credentialIssuedAt ===
        null
    ) {
        return json(
            {
                success: false,
                message:
                    authorization.paymentDispensedAt !==
                        null
                        ? 'O acesso foi autorizado sem pagamento, mas a nova senha ainda não foi emitida pela MA-CODE.'
                        : 'O pagamento está confirmado, mas a nova senha ainda não foi emitida pela MA-CODE.'
            },
            409
        );
    }

    const credential =
        accessState
            .credentials?.[email];

    if (
        !credential ||
        credential.authorizationId !==
            authorization.id ||
        credential.authorizationPlan !==
            authorization.plan
    ) {
        return json(
            {
                success: false,
                message:
                    'A senha disponível não corresponde à autorização atual. Contacte a MA-CODE.'
            },
            409
        );
    }

    /*
     * O motor existente continua responsável por:
     *
     * - validar o hash da senha;
     * - aplicar bloqueios de tentativas;
     * - registar o dispositivo;
     * - emitir a sessão.
     *
     * Só depois de essa validação passar é que este
     * módulo aplica o período comercial autorizado.
     */
    const baseResponse =
        await context.base.fetch(
            request
        );

    if (!baseResponse.ok) {
        return baseResponse;
    }

    let baseBody: JsonObject;

    try {
        baseBody =
            (await baseResponse
                .clone()
                .json()) as JsonObject;
    } catch {
        return json(
            {
                success: false,
                message:
                    'A ativação foi validada, mas a resposta do serviço não pôde ser concluída.'
            },
            500
        );
    }

    const token =
        typeof baseBody.token ===
        'string'
            ? baseBody.token
            : '';

    if (!token) {
        return json(
            {
                success: false,
                message:
                    'A ativação foi validada, mas não foi possível criar a sessão.'
            },
            500
        );
    }

    /*
     * Lemos novamente o estado porque o motor base
     * acabou de criar/atualizar sessão, dispositivo
     * e dados da licença.
     */
    const freshState =
        await context.state.storage.get<AccessStateSnapshot>(
            STORAGE_KEY
        );

    const license =
        freshState
            ?.licenses?.[email];

    const freshRequest =
        freshState
            ?.accessRequests?.[email];

    if (
        !freshState ||
        !license ||
        !freshRequest
    ) {
        return json(
            {
                success: false,
                message:
                    'A ativação foi validada, mas não foi possível concluir a licença paga.'
            },
            500
        );
    }

    const now =
        Date.now();

    const isRenewal =
        Boolean(
            authorization.renewalId
        );

    /*
     * Primeira compra:
     * o validFrom já nasceu no motor base durante
     * esta primeira ativação.
     *
     * Renovação:
     * o NOVO período começa agora, na primeira
     * ativação válida da NOVA senha.
     */
    const validFrom =
        isRenewal
            ? now
            : license.validFrom;

    license.plan =
        authorization.plan;

    license.validFrom =
        validFrom;

    license.validUntil =
        authorization.plan ===
        'paid_30_days'
            ? addDays(
                  validFrom,
                  PAID_30_DAYS
              )
            : getSchoolYearValidUntil(
                  validFrom
              );

    license.revokedAt =
        null;

    license.renewalRequestedAt =
        null;

    license.renewalRequestedPlan =
        null;

    license.updatedAt =
        now;

    /*
     * activatedAt do pedido de acesso representa a
     * primeira ativação da conta. Uma renovação não
     * deve apagar essa data histórica.
     */
    if (!isRenewal) {
        freshRequest.activatedAt =
            validFrom;
    }

    freshRequest.updatedAt =
        now;

    freshState.updatedAt =
        now;

    if (
        isRenewal &&
        authorization.renewalId
    ) {
        const freshRenewal =
            freshState.renewals?.find(
                item =>
                    item.id ===
                    authorization.renewalId
            );

        if (!freshRenewal) {
            return json(
                {
                    success: false,
                    message:
                        'A senha foi validada, mas não foi possível concluir o pedido de renovação.'
                },
                500
            );
        }

        freshRenewal.status =
            'approved';

        freshRenewal.resolvedAt =
            now;

        freshRenewal.updatedAt =
            now;
    }

    /*
     * Marca a autorização como consumida.
     *
     * Isto garante que uma nova utilização da mesma
     * senha pode iniciar sessão, mas NÃO volta a criar
     * mais 30 dias nem a recalcular o ano letivo.
     */
    authorization.activatedAt =
        now;

    authorization.updatedAt =
        now;

    commerceState.updatedAt =
        now;

    await context.state.storage.put({
        [STORAGE_KEY]:
            freshState,

        [COMMERCE_STORAGE_KEY]:
            commerceState
    });

    context.refreshBase();

    return json({
        success: true,
        token,
        license: buildLicenseSummary(
            license,
            now
        )
    });
}

export async function handleMAProfessorPaidAccessRequest(
    request: Request,
    context: PaidAccessContext
): Promise<Response | null> {
    const url =
        new URL(request.url);

    if (
        url.pathname ===
        PUBLIC_ACCESS_REQUEST_PATH
    ) {
        return handlePaidAccessRequest(
            request,
            context
        );
    }

    if (
        url.pathname ===
        PUBLIC_ACCESS_RENEW_PATH
    ) {
        return handlePaidRenewal(
            request,
            context
        );
    }

    if (
        url.pathname ===
        PUBLIC_COMMERCE_STATUS_PATH
    ) {
        return handleCommercialStatus(
            request,
            context
        );
    }

    if (
        url.pathname ===
        PUBLIC_COMMERCE_SELECT_PLAN_PATH
    ) {
        return handleLegacyPlanSelection();
    }

    if (
        url.pathname !==
        PUBLIC_ACCESS_ACTIVATE_PATH
    ) {
        return null;
    }

    return handlePaidActivation(
        request,
        context
    );
}
