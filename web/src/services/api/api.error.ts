/**
 * Result-based error handling for API calls.
 * 
 * This file is generated once by chowbea-axios CLI.
 * You can safely modify this file - it will NOT be overwritten.
 */

import { AxiosError, type AxiosResponse } from "axios";

/* ~ =================================== ~ */
/* -- Types -- */
/* ~ =================================== ~ */

/**
 * Request context for debugging - what request caused the error.
 */
export interface RequestContext {
	/** HTTP method (GET, POST, etc.) */
	method: string;
	/** URL that was called */
	url: string;
	/** Base URL from axios config */
	baseURL?: string;
	/** Query parameters */
	params?: unknown;
	/** Request body (sensitive fields redacted) */
	data?: unknown;
}

/**
 * Normalized API error with extracted message and metadata.
 */
export interface ApiError {
	/** Human-readable error message */
	message: string;
	/** Error code (NETWORK_ERROR, VALIDATION_ERROR, etc.) */
	code: string;
	/** HTTP status code (null for network errors) */
	status: number | null;
	/** What request caused this error */
	request: RequestContext;
	/** Original error response body for debugging */
	details?: unknown;
}

/**
 * Result type - API calls return this instead of throwing.
 * Success: { data: T, error: null }
 * Failure: { data: null, error: ApiError }
 */
export type Result<T> =
	| { data: T; error: null }
	| { data: null; error: ApiError };

/* ~ =================================== ~ */
/* -- Error Normalization -- */
/* ~ =================================== ~ */

/**
 * Normalizes error messages from various API response formats.
 * Handles common patterns from different backend frameworks.
 */
export function normalizeErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") {
		return "An unexpected error occurred";
	}

	const e = error as Record<string, unknown>;

	// Common: { message: "..." }
	if (typeof e.message === "string") return e.message;

	// .NET: { error: "..." } or { error: { message: "..." } }
	if (e.error) {
		if (typeof e.error === "string") return e.error;
		if (typeof (e.error as Record<string, unknown>)?.message === "string") {
			return (e.error as Record<string, unknown>).message as string;
		}
	}

	// Validation: { errors: [...] } or { errors: { field: [...] } }
	if (e.errors) {
		if (Array.isArray(e.errors)) {
			const first = e.errors[0];
			if (typeof first === "string") return first;
			if (typeof first?.message === "string") return first.message;
		} else if (typeof e.errors === "object") {
			const firstField = Object.values(e.errors)[0];
			if (Array.isArray(firstField) && firstField.length > 0) {
				return String(firstField[0]);
			}
		}
	}

	// FastAPI: { detail: "..." } or { detail: [...] }
	if (typeof e.detail === "string") return e.detail;
	if (Array.isArray(e.detail) && e.detail[0]?.msg) {
		return e.detail[0].msg;
	}

	// ASP.NET Problem Details: { title: "..." }
	if (typeof e.title === "string") return e.title;

	return "An unexpected error occurred";
}

/* ~ =================================== ~ */
/* -- Request Context Extraction -- */
/* ~ =================================== ~ */

/** Fields that should be redacted from request data */
const SENSITIVE_FIELDS = [
	"password",
	"token",
	"secret",
	"authorization",
	"apikey",
	"api_key",
	"access_token",
	"refresh_token",
];

/**
 * Redacts sensitive fields from request data for safe logging.
 */
function redactSensitive(data: unknown): unknown {
	if (!data || typeof data !== "object") return data;

	const redacted = { ...(data as Record<string, unknown>) };

	for (const key of Object.keys(redacted)) {
		if (SENSITIVE_FIELDS.some((s) => key.toLowerCase().includes(s))) {
			redacted[key] = "[REDACTED]";
		}
	}

	return redacted;
}

/**
 * Extracts request context from AxiosError for debugging.
 */
function extractRequestContext(err: AxiosError): RequestContext {
	const config = err.config;

	return {
		method: config?.method?.toUpperCase() || "UNKNOWN",
		url: config?.url || "unknown",
		baseURL: config?.baseURL,
		params: config?.params,
		data: redactSensitive(config?.data),
	};
}

/* ~ =================================== ~ */
/* -- Error Creation -- */
/* ~ =================================== ~ */

/**
 * Maps HTTP status codes to error codes.
 */
function getErrorCode(status: number): string {
	if (status >= 500) return "SERVER_ERROR";
	switch (status) {
		case 400:
			return "BAD_REQUEST";
		case 401:
			return "UNAUTHORIZED";
		case 403:
			return "FORBIDDEN";
		case 404:
			return "NOT_FOUND";
		case 409:
			return "CONFLICT";
		case 422:
			return "VALIDATION_ERROR";
		case 429:
			return "RATE_LIMITED";
		default:
			return "REQUEST_ERROR";
	}
}

/**
 * Creates an ApiError from any error.
 */
export function createApiError(err: unknown): ApiError {
	if (err instanceof AxiosError) {
		const request = extractRequestContext(err);

		// Network error (no response)
		if (!err.response) {
			return {
				message: err.code === "ECONNABORTED" 
					? "Request timed out" 
					: "Network error - please check your connection",
				code: err.code === "ECONNABORTED" ? "TIMEOUT" : "NETWORK_ERROR",
				status: null,
				request,
				details: { code: err.code, message: err.message },
			};
		}

		// Server responded with error
		const status = err.response.status;

		return {
			message: normalizeErrorMessage(err.response.data),
			code: getErrorCode(status),
			status,
			request,
			details: err.response.data,
		};
	}

	// Unknown error
	return {
		message: err instanceof Error ? err.message : "An unexpected error occurred",
		code: "UNKNOWN_ERROR",
		status: null,
		request: { method: "UNKNOWN", url: "unknown" },
		details: err,
	};
}

/* ~ =================================== ~ */
/* -- Safe Request Wrapper -- */
/* ~ =================================== ~ */

/**
 * Wraps an axios promise and returns a Result instead of throwing.
 * 
 * @example
 * ```typescript
 * const { data, error } = await safeRequest(axios.get("/users"));
 * if (error) {
 *   console.error(error.message);
 *   return;
 * }
 * console.log(data);
 * ```
 */
export async function safeRequest<T>(
	promise: Promise<AxiosResponse<T>>
): Promise<Result<T>> {
	try {
		const response = await promise;
		return { data: response.data, error: null };
	} catch (err) {
		return { data: null, error: createApiError(err) };
	}
}

/**
 * Type guard to check if a result is successful.
 */
export function isSuccess<T>(result: Result<T>): result is { data: T; error: null } {
	return result.error === null;
}

/**
 * Type guard to check if a result is an error.
 */
export function isError<T>(result: Result<T>): result is { data: null; error: ApiError } {
	return result.error !== null;
}
