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

interface AccessStateSnapshot {
    licenses?: Record<string, StoredLicenseSnapshot>;
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
    paymentConfirmedAt: number | null;
    paymentDispensedAt?: number | null;
    credentialIssuedAt: number | null;
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
    put<T>(key: string, value: T): Promise<void>;
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
        paymentDispensedAt:
            authorization.paymentDispensedAt ??
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
    const canActivate =
        requestStatus === 'approved' &&
        !existingLicense &&
        Boolean(
            authorization &&
                isPaymentResolved(
                    authorization
                ) &&
                authorization
                    .credentialIssuedAt !==
                    null
        );

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
        latestAuthorization;

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
            paymentConfirmedAt: null,
            paymentDispensedAt: null,
            credentialIssuedAt: null,
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

    /*
     * Contas que já têm licença continuam a ser
     * tratadas pelo motor existente. Este módulo
     * só intervém na primeira ativação paga.
     */
    if (
        !accessState ||
        !accessRequest ||
        accessRequest.status !==
            'approved' ||
        accessState
            .licenses?.[email]
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
        return json(
            {
                success: false,
                message:
                    'Ainda não existe uma autorização comercial associada a esta conta.'
            },
            409
        );
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
     * - validar o hash da senha;
     * - bloquear tentativas repetidas;
     * - registar o dispositivo;
     * - emitir a sessão.
     *
     * Depois da validação, substituímos a licença
     * transitória criada pelo motor base pelo plano
     * que foi realmente autorizado.
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

    const validFrom =
        license.validFrom;

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
    license.revokedAt = null;
    license.renewalRequestedAt =
        null;
    license.renewalRequestedPlan =
        null;
    license.updatedAt =
        Date.now();

    freshRequest.activatedAt =
        validFrom;
    freshRequest.updatedAt =
        license.updatedAt;
    freshState.updatedAt =
        license.updatedAt;

    await context.state.storage.put(
        STORAGE_KEY,
        freshState
    );

    context.refreshBase();

    return json({
        success: true,
        token,
        license: buildLicenseSummary(
            license,
            license.updatedAt
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
