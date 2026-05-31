/**
 * Typed HTTP client for API.
 * 
 * This file is generated once by chowbea-axios CLI.
 * You can safely modify this file - it will NOT be overwritten.
 */

import type { AxiosRequestConfig, AxiosResponse } from "axios";

import { axiosInstance } from "./api.instance";
import { safeRequest, type Result } from "./api.error";
import type { paths, components, operations } from "./_generated/api.types";
import { createOperations } from "./_generated/api.operations";

/* ~ =================================== ~ */
/* -- Type Helpers -- */
/* ~ =================================== ~ */

/** All path templates defined by the OpenAPI paths map. */
type Paths = keyof paths;

/** HTTP methods supported by the client. */
type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

/** Resolves the OpenAPI operation schema for a given path and method. */
type Operation<P extends Paths, M extends HttpMethod> = paths[P][M];

/** Extracts placeholder parameter names from an OpenAPI-style path template. */
type ExtractPathParamNames<T extends string> =
	T extends `${string}{${infer P}}${infer R}`
		? P | ExtractPathParamNames<R>
		: never;

/** Maps extracted path parameter names to a simple serializable value type. */
type PathParams<P extends Paths> = ExtractPathParamNames<
	P & string
> extends never
	? never
	: Record<ExtractPathParamNames<P & string>, string | number | boolean>;

/** Extracts query parameter types from the OpenAPI operation schema. */
type QueryParams<P extends Paths, M extends HttpMethod> = Operation<
	P,
	M
> extends { parameters: { query?: infer Q } }
	? Q extends Record<string, unknown>
		? Q
		: never
	: never;

/** Extended Axios config that includes typed query parameters. */
type TypedAxiosConfig<P extends Paths, M extends HttpMethod> = Omit<
	AxiosRequestConfig,
	"params"
> & {
	params?: QueryParams<P, M>;
};

/**
 * Infers the request body type for a given path/method pair.
 *
 * Multipart bodies inherit types directly from the contracts file,
 * which already emits File or Blob for format binary fields. The
 * earlier MapFormDataTypes substring heuristic is gone — issue #22.
 */
type RequestBody<P extends Paths, M extends HttpMethod> = Operation<
	P,
	M
> extends {
	requestBody: { content: { "application/json": infer T } };
}
	? T extends Record<string, never>
		? Record<string, unknown>
		: T
	: Operation<P, M> extends {
				requestBody?: { content: { "application/json": infer T } };
			}
		? T extends Record<string, never>
			? Record<string, unknown>
			: T
		: Operation<P, M> extends {
					requestBody: { content: { "multipart/form-data": infer T } };
				}
			? T
			: Operation<P, M> extends {
						requestBody?: { content: { "multipart/form-data": infer T } };
					}
				? T
				: never;

/** Infers the JSON response body type for a given status code. */
type ResponseData<
	P extends Paths,
	M extends HttpMethod,
> = Operation<P, M> extends {
	responses: { 200: { content: { "application/json": infer T } } };
}
	? T
	: Operation<P, M> extends {
				responses: { 201: { content: { "application/json": infer T } } };
			}
		? T
		: unknown;

/* ~ =================================== ~ */
/* -- Utility Functions -- */
/* ~ =================================== ~ */

/**
 * Replaces {param} placeholders in a path template using provided values.
 */
function interpolatePath<P extends Paths>(
	template: P,
	params?: PathParams<P> | never
): string {
	const pathStr = String(template);
	if (!params) return pathStr;

	const missing: string[] = [];
	const result = pathStr.replace(/\{([^}]+)\}/g, (match, key: string) => {
		const value = (params as Record<string, unknown>)[key];
		if (value === undefined || value === null) {
			missing.push(key);
			return match;
		}
		return encodeURIComponent(String(value));
	});

	if (missing.length > 0) {
		throw new Error(
			`Missing required path param(s): ${missing.join(", ")} for template: ${pathStr}`
		);
	}

	return result;
}

/**
 * Checks if the request should use multipart/form-data.
 *
 * Only triggers when the user explicitly passes a FormData instance.
 * The earlier path-regex heuristic misclassified any path matching
 * "/upload$", "/upload-images$", or "/files/upload$" as multipart
 * regardless of the spec. Multipart endpoints now require the user to
 * construct FormData themselves — the contracts file's File or Blob
 * types guide that construction. Issue #22.
 */
function shouldUseFormData(_path: string, data: unknown): boolean {
	return data instanceof FormData;
}

/**
 * Converts a plain object to FormData for multipart/form-data requests.
 */
function convertToFormData(data: Record<string, unknown>): FormData {
	const formData = new FormData();
	for (const [key, value] of Object.entries(data)) {
		if (value === undefined || value === null) continue;
		if (value instanceof File || value instanceof Blob) {
			formData.append(key, value);
		} else if (Array.isArray(value)) {
			for (const item of value) {
				if (item instanceof File || item instanceof Blob) {
					formData.append(key, item);
				} else {
					formData.append(key, String(item));
				}
			}
		} else {
			formData.append(key, String(value));
		}
	}
	return formData;
}

/* ~ =================================== ~ */
/* -- API Client -- */
/* ~ =================================== ~ */

/**
 * Typed API client with Result-based error handling.
 * All methods return { data, error } instead of throwing.
 */
const api = {
	/**
	 * Sends a GET request to the given OpenAPI path.
	 * Returns Result<T> - never throws.
	 */
	get<P extends Paths>(
		url: P,
		...args: PathParams<P> extends never
			? [config?: TypedAxiosConfig<P, "get">]
			: [pathParams: PathParams<P>, config?: TypedAxiosConfig<P, "get">]
	): Promise<Result<ResponseData<P, "get">>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as TypedAxiosConfig<P, "get"> | undefined)
			: (pathParamsOrConfig as TypedAxiosConfig<P, "get"> | undefined);

		return safeRequest(
			axiosInstance.get<ResponseData<P, "get">>(
				interpolatePath(url, pathParams),
				finalConfig
			)
		);
	},

	/**
	 * Sends a POST request with a body inferred from the OpenAPI spec.
	 * Returns Result<T> - never throws.
	 */
	post<P extends Paths>(
		url: P,
		data: RequestBody<P, "post">,
		...args: PathParams<P> extends never
			? [config?: TypedAxiosConfig<P, "post">]
			: [pathParams: PathParams<P>, config?: TypedAxiosConfig<P, "post">]
	): Promise<Result<ResponseData<P, "post">>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as TypedAxiosConfig<P, "post"> | undefined)
			: (pathParamsOrConfig as TypedAxiosConfig<P, "post"> | undefined);

		const resolvedPath = interpolatePath(url, pathParams);
		const requestData = shouldUseFormData(resolvedPath, data)
			? data instanceof FormData
				? data
				: convertToFormData(data as Record<string, unknown>)
			: data;

		return safeRequest(
			axiosInstance.post<ResponseData<P, "post">>(
				resolvedPath,
				requestData,
				finalConfig
			)
		);
	},

	/**
	 * Sends a PUT request with a JSON body.
	 * Returns Result<T> - never throws.
	 */
	put<P extends Paths>(
		url: P,
		data: RequestBody<P, "put">,
		...args: PathParams<P> extends never
			? [config?: TypedAxiosConfig<P, "put">]
			: [pathParams: PathParams<P>, config?: TypedAxiosConfig<P, "put">]
	): Promise<Result<ResponseData<P, "put">>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as TypedAxiosConfig<P, "put"> | undefined)
			: (pathParamsOrConfig as TypedAxiosConfig<P, "put"> | undefined);

		return safeRequest(
			axiosInstance.put<ResponseData<P, "put">>(
				interpolatePath(url, pathParams),
				data,
				finalConfig
			)
		);
	},

	/**
	 * Sends a DELETE request.
	 * Returns Result<T> - never throws.
	 */
	delete<P extends Paths>(
		url: P,
		...args: PathParams<P> extends never
			? [config?: TypedAxiosConfig<P, "delete">]
			: [pathParams: PathParams<P>, config?: TypedAxiosConfig<P, "delete">]
	): Promise<Result<ResponseData<P, "delete">>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as TypedAxiosConfig<P, "delete"> | undefined)
			: (pathParamsOrConfig as TypedAxiosConfig<P, "delete"> | undefined);

		return safeRequest(
			axiosInstance.delete<ResponseData<P, "delete">>(
				interpolatePath(url, pathParams),
				finalConfig
			)
		);
	},

	/**
	 * Sends a PATCH request with a JSON body.
	 * Returns Result<T> - never throws.
	 */
	patch<P extends Paths>(
		url: P,
		data: RequestBody<P, "patch">,
		...args: PathParams<P> extends never
			? [config?: TypedAxiosConfig<P, "patch">]
			: [pathParams: PathParams<P>, config?: TypedAxiosConfig<P, "patch">]
	): Promise<Result<ResponseData<P, "patch">>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as TypedAxiosConfig<P, "patch"> | undefined)
			: (pathParamsOrConfig as TypedAxiosConfig<P, "patch"> | undefined);

		return safeRequest(
			axiosInstance.patch<ResponseData<P, "patch">>(
				interpolatePath(url, pathParams),
				data,
				finalConfig
			)
		);
	},

	/**
	 * Sends a HEAD request — returns response headers only (no body).
	 * Returns Result<T> - never throws.
	 */
	head<P extends Paths>(
		url: P,
		...args: PathParams<P> extends never
			? [config?: AxiosRequestConfig]
			: [pathParams: PathParams<P>, config?: AxiosRequestConfig]
	): Promise<Result<unknown>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as AxiosRequestConfig | undefined)
			: (pathParamsOrConfig as AxiosRequestConfig | undefined);

		return safeRequest(
			axiosInstance.head<unknown>(
				interpolatePath(url, pathParams),
				finalConfig
			)
		);
	},

	/**
	 * Sends an OPTIONS request — used for CORS preflight diagnostics.
	 * Returns Result<T> - never throws.
	 */
	options<P extends Paths>(
		url: P,
		...args: PathParams<P> extends never
			? [config?: AxiosRequestConfig]
			: [pathParams: PathParams<P>, config?: AxiosRequestConfig]
	): Promise<Result<unknown>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as AxiosRequestConfig | undefined)
			: (pathParamsOrConfig as AxiosRequestConfig | undefined);

		return safeRequest(
			axiosInstance.options<unknown>(
				interpolatePath(url, pathParams),
				finalConfig
			)
		);
	},

	/**
	 * Sends a TRACE request — diagnostic loopback. Rarely used in
	 * production; routed through axios.request() since the SDK has no
	 * .trace() shortcut.
	 * Returns Result<T> - never throws.
	 */
	trace<P extends Paths>(
		url: P,
		...args: PathParams<P> extends never
			? [config?: AxiosRequestConfig]
			: [pathParams: PathParams<P>, config?: AxiosRequestConfig]
	): Promise<Result<unknown>> {
		const hasPathParams = String(url).includes("{");
		const [pathParamsOrConfig, config] = args;

		const pathParams = hasPathParams
			? (pathParamsOrConfig as PathParams<P>)
			: undefined;
		const finalConfig = hasPathParams
			? (config as AxiosRequestConfig | undefined)
			: (pathParamsOrConfig as AxiosRequestConfig | undefined);

		return safeRequest(
			axiosInstance.request<unknown>({
				...finalConfig,
				method: "TRACE",
				url: interpolatePath(url, pathParams),
			})
		);
	},

	/**
	 * Operation-based API methods generated from OpenAPI operationIds.
	 * Provides semantic function names instead of raw path endpoints.
	 */
	get op() {
		return createOperations(this);
	},
};

export { api };
export type { Paths, HttpMethod, PathParams, QueryParams, RequestBody, ResponseData };

// Re-export error types for convenience
export type { ApiError, Result, RequestContext } from "./api.error";
export { createApiError, safeRequest, isSuccess, isError } from "./api.error";

// Re-export types for convenience
export type { paths, components, operations };
