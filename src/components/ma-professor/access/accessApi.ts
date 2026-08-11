import type {
    LicenseSummary
} from '../types';

import type {
    MAProfessorAccessRequestResponse,
    MAProfessorAccessResponse,
    MAProfessorLicenseResponse,
    MAProfessorRenewalResponse,
    RenewableLicensePlan
} from './accessTypes';

const API_PREFIX =
    '/api/ma-professor/access';

interface ApiErrorBody {
    success?: boolean;
    message?: string;
}

async function postJson<T>(
    path: string,
    body: Record<
        string,
        unknown
    >
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(
            `${API_PREFIX}${path}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json',
                    Accept:
                        'application/json'
                },
                body: JSON.stringify(
                    body
                )
            }
        );
    } catch {
        throw new Error(
            'Não foi possível ligar ao serviço de acesso. Verifique a ligação e tente novamente.'
        );
    }

    let data: unknown;

    try {
        data =
            await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message =
            data &&
            typeof data ===
                'object'
                ? (
                      data as ApiErrorBody
                  ).message
                : '';

        throw new Error(
            message ||
                'Não foi possível concluir o pedido. Tente novamente.'
        );
    }

    return data as T;
}

export async function requestMAProfessorAccess(
    email: string
) {
    return postJson<MAProfessorAccessRequestResponse>(
        '/request',
        {
            email
        }
    );
}

export async function activateMAProfessorAccess(
    email: string,
    password: string,
    deviceId: string
) {
    return postJson<MAProfessorAccessResponse>(
        '/activate',
        {
            email,
            password,
            deviceId
        }
    );
}

export async function verifyMAProfessorAccess(
    token: string,
    deviceId: string
) {
    return postJson<MAProfessorLicenseResponse>(
        '/verify',
        {
            token,
            deviceId
        }
    );
}

export async function confirmMAProfessorPilotAccess(
    token: string,
    deviceId: string
) {
    return postJson<MAProfessorLicenseResponse>(
        '/confirm-pilot',
        {
            token,
            deviceId
        }
    );
}

export async function requestMAProfessorRenewal(
    token: string,
    deviceId: string,
    requestedPlan: RenewableLicensePlan
) {
    return postJson<MAProfessorRenewalResponse>(
        '/renew',
        {
            token,
            deviceId,
            requestedPlan
        }
    );
}

export async function endMAProfessorSession(
    token: string,
    deviceId: string
) {
    return postJson<{
        success: true;
    }>(
        '/logout',
        {
            token,
            deviceId
        }
    );
}

export function createSessionLicense(
    license: LicenseSummary
) {
    return license;
}
