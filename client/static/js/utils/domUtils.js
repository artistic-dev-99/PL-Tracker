// DOM Helper Utilities
import { state } from '../state.js';

export function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function updateApiUrl() {
    const protocol = (typeof window !== "undefined" && window.location && window.location.protocol && window.location.protocol.startsWith("https")) ? "https" : "http";
    state.apiUrl = `${protocol}://${state.serverIp}:${state.serverPort}`;
}

export function showStatusIndicator(status, text) {
    const indicator = document.getElementById("connection-status-indicator");
    if (!indicator) return;

    indicator.classList.remove("hidden");
    const dot = indicator.querySelector(".dot");
    const textEl = indicator.querySelector(".status-text");

    if (dot) {
        dot.className = "dot";
        if (status === "connected") dot.classList.add("green");
        else if (status === "connecting") dot.classList.add("yellow");
        else if (status === "disconnected") dot.classList.add("red");
    }

    if (textEl) {
        textEl.innerText = text;
    }
}

export function showOfflineBanner() {
    let banner = document.getElementById("offline-reconnect-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "offline-reconnect-banner";
        banner.className = "offline-banner fade-in";
        banner.innerHTML = `
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;display:inline-block;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Network connection lost. Reconnecting to server at <strong>${escapeHtml(state.apiUrl)}</strong>...</span>
            <button id="retry-connection-btn" class="compact-btn dark-btn">Retry Now</button>
        `;
        const mainContent = document.querySelector(".app-main-content");
        if (mainContent) {
            mainContent.insertBefore(banner, mainContent.firstChild);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }

        const retryBtn = document.getElementById("retry-connection-btn");
        if (retryBtn) {
            retryBtn.addEventListener("click", () => {
                if (window.checkServerConnection) window.checkServerConnection();
            });
        }
    }
}

export function hideOfflineBanner() {
    const banner = document.getElementById("offline-reconnect-banner");
    if (banner) {
        banner.remove();
    }
}

export function applyStatusBarMode(mode) {
    const bar = document.getElementById("ide-status-bar");
    if (!bar) return;
    bar.classList.remove("mode-accent", "mode-contrast");
    if (mode === "contrast") {
        bar.classList.add("mode-contrast");
    } else {
        bar.classList.add("mode-accent");
    }
}
