/**
 * Axios instance with authentication interceptor.
 *
 * This file is generated once by chowbea-axios CLI.
 * You can safely modify this file - it will NOT be overwritten.
 */

import axios from "axios";

/**
 * Shared Axios instance configured with the API base URL.
 */
export const axiosInstance = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	withCredentials: true,
	timeout: 60000,
});

/**
 * Request interceptor for authentication.
 * TODO: Implement your auth logic here.
 *
 * Examples:
 *   config.headers.Authorization = `Bearer ${getToken()}`;
 *   config.headers["X-API-Key"] = getApiKey();
 */
axiosInstance.interceptors.request.use(
	(config) => {
		// Add your auth logic here
		return config;
	},
	(error) => Promise.reject(error)
);
