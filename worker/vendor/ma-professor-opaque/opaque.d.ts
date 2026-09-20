/* tslint:disable */
/* eslint-disable */
export interface CreateServerRegistrationResponseParams {
    serverSetup: string;
    userIdentifier: string;
    registrationRequest: string;
}

export interface CreateServerRegistrationResponseResult {
    registrationResponse: string;
}

export interface CustomIdentifiers {
    client?: string;
    server?: string;
}

export interface FinishClientLoginParams {
    clientLoginState: string;
    loginResponse: string;
    password: string;
    identifiers?: CustomIdentifiers;
    keyStretching?: KeyStretchingFunctionConfig;
}

export interface FinishClientLoginResult {
    finishLoginRequest: string;
    sessionKey: string;
    exportKey: string;
    serverStaticPublicKey: string;
}

export interface FinishClientRegistrationParams {
    password: string;
    registrationResponse: string;
    clientRegistrationState: string;
    identifiers?: CustomIdentifiers;
    keyStretching?: KeyStretchingFunctionConfig;
}

export interface FinishClientRegistrationResult {
    registrationRecord: string;
    exportKey: string;
    serverStaticPublicKey: string;
}

export interface FinishServerLoginParams {
    serverLoginState: string;
    finishLoginRequest: string;
    identifiers?: CustomIdentifiers;
}

export interface FinishServerLoginResult {
    sessionKey: string;
}

export interface StartClientLoginParams {
    password: string;
}

export interface StartClientLoginResult {
    clientLoginState: string;
    startLoginRequest: string;
}

export interface StartClientRegistrationParams {
    password: string;
}

export interface StartClientRegistrationResult {
    clientRegistrationState: string;
    registrationRequest: string;
}

export interface StartServerLoginParams {
    serverSetup: string;
    registrationRecord: string | null | undefined;
    startLoginRequest: string;
    userIdentifier: string;
    identifiers?: CustomIdentifiers;
}

export interface StartServerLoginResult {
    serverLoginState: string;
    loginResponse: string;
}

export type KeyStretchingFunctionConfig = "rfc-recommended" | "rfc-draft-recommended" | "memory-constrained" | { "argon2id-custom": { iterations: number; memory: number; parallelism: number } };


export function createServerRegistrationResponse(params: CreateServerRegistrationResponseParams): CreateServerRegistrationResponseResult;

export function createServerSetup(): string;

export function finishClientLogin(params: FinishClientLoginParams): FinishClientLoginResult | undefined;

export function finishClientRegistration(params: FinishClientRegistrationParams): FinishClientRegistrationResult;

export function finishServerLogin(params: FinishServerLoginParams): FinishServerLoginResult;

export function getServerPublicKey(data: string): string;

export function startClientLogin(params: StartClientLoginParams): StartClientLoginResult;

export function startClientRegistration(params: StartClientRegistrationParams): StartClientRegistrationResult;

export function startServerLogin(params: StartServerLoginParams): StartServerLoginResult;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly createServerRegistrationResponse: (a: any) => [number, number, number];
    readonly createServerSetup: () => [number, number];
    readonly finishClientLogin: (a: any) => [number, number, number];
    readonly finishClientRegistration: (a: any) => [number, number, number];
    readonly finishServerLogin: (a: any) => [number, number, number];
    readonly getServerPublicKey: (a: number, b: number) => [number, number, number, number];
    readonly startClientLogin: (a: any) => [number, number, number];
    readonly startClientRegistration: (a: any) => [number, number, number];
    readonly startServerLogin: (a: any) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
