// Centralized HTTP API Module
import { state } from './state.js';
import { showStatusIndicator, showOfflineBanner, hideOfflineBanner } from './utils/domUtils.js';

export const api = {
    async request(path, options = {}) {
        const url = `${state.apiUrl}${path}`;
        const controller = new AbortController();
        const timeout = options.timeout || 10000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const defaultHeaders = {
            "Content-Type": "application/json"
        };

        const config = {
            ...options,
            headers: options.body instanceof FormData
                ? options.headers
                : { ...defaultHeaders, ...options.headers },
            signal: controller.signal
        };

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            let data;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const message = (data && data.message) || `HTTP error ${response.status}`;
                throw { status: "error", message, data };
            }

            if (data && data.status === "error") {
                throw { status: "error", message: data.message || "Operation failed", data };
            }

            // Connection is online
            if (state.isOffline) {
                state.isOffline = false;
                showStatusIndicator("connected", "Connected");
                hideOfflineBanner();
                if (window.startLivePoller) {
                    window.startLivePoller();
                }
                if (state.currentUser && window.refreshActiveTabData) {
                    window.refreshActiveTabData();
                }
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            const isTimeout = error.name === "AbortError";
            const isNetwork = error instanceof TypeError || error.message === "Failed to fetch";

            if (isTimeout || isNetwork) {
                state.isOffline = true;
                showStatusIndicator("disconnected", "Offline");
                showOfflineBanner();
                if (window.stopLivePoller) {
                    window.stopLivePoller();
                }
                throw { status: "error", message: "Network connection lost. Please check your server status.", isNetwork: true };
            }

            throw error;
        }
    },

    get(path, options = {}) {
        return this.request(path, { ...options, method: "GET" });
    },

    post(path, body, options = {}) {
        return this.request(path, {
            ...options,
            method: "POST",
            body: body instanceof FormData ? body : JSON.stringify(body)
        });
    },

    put(path, body, options = {}) {
        return this.request(path, {
            ...options,
            method: "PUT",
            body: body instanceof FormData ? body : JSON.stringify(body)
        });
    },

    delete(path, body, options = {}) {
        return this.request(path, {
            ...options,
            method: "DELETE",
            body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
        });
    }
};

if (typeof window !== "undefined") {
    window.api = api;
}
