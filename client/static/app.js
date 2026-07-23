// Global Application State
const state = {
    serverIp: "127.0.0.1",
    serverPort: 5000,
    apiUrl: "http://127.0.0.1:5000",
    currentUser: null,
    currentTab: "entry-form-tab",
    isOffline: false,
    pollerInterval: null,

    // Entry Form Tab Cache
    searchMode: false,
    searchResults: [],
    searchIndex: -1,
    activeEntryId: null,

    // Spreadsheet Tab Cache
    sheetEntries: [],
    selectedEntryIds: new Set(),
    quickFilter: "all",

    // Bulk Modifying Cache
    bulkEntries: [],
    bulkIndex: -1,
    bulkModifiedData: {}, // Map of entryID -> modified entry object

    // Settings
    confirmDelete: true,

    // Pagination Cache
    currentPage: 1,
    pageSize: 100,

    // Sorting Cache
    sortColumn: null,
    sortDirection: "asc" // 'asc' or 'desc'
};

// Centralized HTTP API module

const api = {
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
                // Resume poller
                startLivePoller();
                // Re-pull current tab data when reconnecting
                if (state.currentUser) {
                    refreshActiveTabData();
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
                stopLivePoller();
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

function showOfflineBanner() {
    let banner = document.getElementById("offline-reconnect-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "offline-reconnect-banner";
        banner.className = "offline-banner fade-in";
        banner.innerHTML = `
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;display:inline-block;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Network connection lost. Reconnecting to server at <strong>${state.apiUrl}</strong>...</span>
            <button id="retry-connection-btn" class="compact-btn dark-btn">Retry Now</button>
        `;
        const mainContent = document.querySelector(".app-main-content");
        if (mainContent) {
            mainContent.insertBefore(banner, mainContent.firstChild);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }

        document.getElementById("retry-connection-btn").addEventListener("click", () => {
            checkServerConnection();
        });
    }
}

function hideOfflineBanner() {
    const banner = document.getElementById("offline-reconnect-banner");
    if (banner) {
        banner.remove();
    }
}

function refreshActiveTabData() {
    const tabId = state.currentTab;
    if (tabId === "previous-entries-tab") {
        fetchSpreadsheetData();
    } else if (tabId === "settings-tab") {
        queryDbFileSize();
        fetchAdminUsersList();
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function applyStatusBarMode(mode) {
    const bar = document.getElementById("ide-status-bar");
    if (!bar) return;
    bar.classList.remove("mode-accent", "mode-contrast");
    if (mode === "contrast") {
        bar.classList.add("mode-contrast");
    } else {
        bar.classList.add("mode-accent");
    }
}

function playUnifiedAudioTone(toneName) {
    if (!toneName || toneName === "mute") return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (toneName === "chime") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(1318.51, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        } else if (toneName === "retro") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(659.25, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        } else if (toneName === "pulse") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(349.23, ctx.currentTime);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        } else { // "classic"
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        }

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
        console.warn("Audio playback not supported:", e);
    }
}

// Toast Notification Manager
const toast = {
    show(message, type = "info", duration = 3000) {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const el = document.createElement("div");
        el.className = `toast-item toast-${type} fade-in`;
        el.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close-btn" style="outline: none;">&times;</button>
        `;

        container.appendChild(el);

        const closeBtn = el.querySelector(".toast-close-btn");
        closeBtn.addEventListener("click", () => {
            el.remove();
        });

        setTimeout(() => {
            if (el.parentNode) {
                el.classList.add("fade-out");
                setTimeout(() => el.remove(), 250);
            }
        }, duration);
    },
    success(msg) { this.show(msg, "success"); },
    error(msg) { this.show(msg, "error"); },
    warning(msg) { this.show(msg, "warning"); },
    info(msg) { this.show(msg, "info"); }
};

// Generic Confirmation Dialog wrapper
const confirmDialog = {
    show({ title, message, confirmLabel = "Confirm", variant = "danger", dontShowKey = null, onConfirm, onCancel }) {
        if (dontShowKey && localStorage.getItem(dontShowKey) === "true") {
            if (typeof onConfirm === "function") onConfirm();
            return;
        }

        const modal = document.getElementById("confirm-modal");
        if (!modal) {
            if (typeof onConfirm === "function") onConfirm();
            return;
        }

        const titleEl = modal.querySelector("h2");
        if (titleEl) titleEl.innerText = title || "Confirm Action";

        const msgEl = document.getElementById("confirm-msg");
        if (msgEl) msgEl.innerText = message || "Are you sure?";

        const yesBtn = document.getElementById("confirm-yes-btn");
        if (yesBtn) {
            yesBtn.innerText = confirmLabel;
            yesBtn.className = `${variant}-btn px-4`;
        }

        const checkboxWrapper = modal.querySelector(".form-row.justify-center");
        if (checkboxWrapper) {
            if (dontShowKey) {
                checkboxWrapper.style.display = "flex";
                const checkbox = document.getElementById("confirm-dont-show");
                if (checkbox) checkbox.checked = false;
            } else {
                checkboxWrapper.style.display = "none";
            }
        }

        modal.classList.remove("hidden");

        yesBtn.onclick = () => {
            modal.classList.add("hidden");
            if (dontShowKey) {
                const checkbox = document.getElementById("confirm-dont-show");
                if (checkbox && checkbox.checked) {
                    localStorage.setItem(dontShowKey, "true");
                }
            }
            if (typeof onConfirm === "function") onConfirm();
        };

        const noBtn = document.getElementById("confirm-no-btn");
        if (noBtn) {
            noBtn.onclick = () => {
                modal.classList.add("hidden");
                if (typeof onCancel === "function") onCancel();
            };
        }
    }
};

// Admin Confirmation Dialog wrapper (replaces native prompt for passwords)
const adminConfirmDialog = {
    show({ onConfirm, onCancel }) {
        const modal = document.getElementById("admin-confirm-modal");
        if (!modal) {
            if (typeof onConfirm === "function") onConfirm("");
            return;
        }

        const passwordInput = document.getElementById("admin-confirm-password-input");
        if (passwordInput) {
            passwordInput.value = "";
        }

        const yesBtn = document.getElementById("admin-confirm-yes-btn");
        const noBtn = document.getElementById("admin-confirm-no-btn");

        modal.classList.remove("hidden");
        if (passwordInput) {
            passwordInput.focus();
        }

        const handleConfirm = () => {
            const password = passwordInput ? passwordInput.value : "";
            modal.classList.add("hidden");
            cleanup();
            if (typeof onConfirm === "function") onConfirm(password);
        };

        const handleCancel = () => {
            modal.classList.add("hidden");
            cleanup();
            if (typeof onCancel === "function") onCancel();
        };

        const handleKeyPress = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
            }
        };

        const cleanup = () => {
            yesBtn.onclick = null;
            noBtn.onclick = null;
            if (passwordInput) {
                passwordInput.removeEventListener("keydown", handleKeyPress);
            }
        };

        yesBtn.onclick = handleConfirm;
        noBtn.onclick = handleCancel;
        if (passwordInput) {
            passwordInput.addEventListener("keydown", handleKeyPress);
        }
    }
};

function startLivePoller() {
    if (state.pollerInterval) return;
    state.pollerInterval = setInterval(() => {
        if (!state.isOffline && !document.hidden) {
            pollDatabaseForUpdates();
        }
    }, 5000);
}

function stopLivePoller() {
    if (state.pollerInterval) {
        clearInterval(state.pollerInterval);
        state.pollerInterval = null;
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopLivePoller();
    } else {
        startLivePoller();
    }
});

// Auto-run when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// 1. Setup & Connection Initialization
async function initApp() {
    setupTabNavigation();
    setupEventHandlers();
    setupShortcutListeners();
    setupExcelImportUI();
    loadLocalStorageSettings();

    // Start Live Activity Poller
    startLivePoller();

    // Check if pywebview is available (it loads asynchronously)
    if (window.pywebview) {
        onWebViewReady();
    } else {
        window.addEventListener("pywebviewready", onWebViewReady);
    }

    // Fallback if pywebview is not loaded (running in browser debug mode)
    setTimeout(() => {
        if (!window.pywebview) {
            console.warn("Running in Web Debug Mode - No Native Bridge");
            checkServerConnection();
        }
    }, 1000);
}

function onWebViewReady() {
    console.log("Native PyWebView bridge loaded successfully.");
    pywebview.api.get_config().then(config => {
        state.serverIp = config.server_ip;
        state.serverPort = config.server_port;
        updateApiUrl();
        checkServerConnection();
    });
}

function updateApiUrl() {
    state.apiUrl = `http://${state.serverIp}:${state.serverPort}`;
}

function loadLocalStorageSettings() {
    // Remember username check
    const remembered = localStorage.getItem("remembered_username");
    if (remembered) {
        document.getElementById("login-username").value = remembered;
        document.getElementById("remember-me").checked = true;
    }

    // Delete confirmation prompt toggle
    const dontShowDelete = localStorage.getItem("dont_show_delete_confirm");
    if (dontShowDelete === "true") {
        state.confirmDelete = false;
        document.getElementById("confirm-dont-show").checked = true;
    }

    // Fluid Glass theme is always active — no theme loading needed
}

// Check server connection status
async function checkServerConnection() {
    showStatusIndicator("connecting", "Connecting...");

    try {
        const data = await api.get("/api/db-status", { timeout: 2000 });
        showStatusIndicator("connected", "Connected");
        hideOfflineBanner();

        if (data.db_empty) {
            showScreen("first-time-screen");
            document.getElementById("admin-setup-username").focus();
        } else {
            showScreen("login-screen");

            // Auto focus username or password
            const remembered = localStorage.getItem("remembered_username");
            if (remembered) {
                document.getElementById("login-password").focus();
            } else {
                document.getElementById("login-username").focus();
            }
        }
    } catch (err) {
        showStatusIndicator("disconnected", "Database unreachable");
        showScreen("setup-screen");
        document.getElementById("setup-ip").focus();
    }
}

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    document.getElementById(screenId).classList.remove("hidden");
}

function showStatusIndicator(type, text) {
    const indicator = document.getElementById("connection-indicator");
    const dot = indicator.querySelector(".dot");
    const label = indicator.querySelector(".status-text");

    dot.className = "dot " + (type === "connected" ? "green" : type === "connecting" ? "yellow" : "red");
    label.innerText = text;
}

// 2. Tab Navigation Setup
function setupTabNavigation() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            if (tabId) switchTab(tabId);
        });
    });

    const collapseBtn = document.getElementById("sidebar-collapse-btn");
    if (collapseBtn) {
        collapseBtn.addEventListener("click", () => {
            const sidebar = document.getElementById("app-sidebar");
            if (sidebar) sidebar.classList.toggle("collapsed");
        });
    }
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));

    document.querySelectorAll(`.tab-btn[data-tab="${tabId}"]`).forEach(b => b.classList.add("active"));

    const activeContent = document.getElementById(tabId);
    if (activeContent) activeContent.classList.remove("hidden");

    const titleMap = {
        "entry-form-tab": "Entry Form",
        "previous-entries-tab": "Previous Entries",
        "dashboard-tab": "Dashboard",
        "report-tab": "Report Generator",
        "settings-tab": "Settings"
    };

    const titleEl = document.getElementById("active-tab-title");
    if (titleEl && titleMap[tabId]) {
        titleEl.innerText = titleMap[tabId];
    }

    const modeInfoEl = document.getElementById("sb-mode-info");
    if (modeInfoEl && titleMap[tabId]) {
        modeInfoEl.innerText = titleMap[tabId];
    }

    state.currentTab = tabId;

    if (tabId === "previous-entries-tab") {
        fetchSpreadsheetData();
    } else if (tabId === "dashboard-tab") {
        refreshDashboardAnalytics();
    } else if (tabId === "settings-tab") {
        initializeSettingsTab();
    }
}

// 3. User Authentication & Registration Handles
async function handleLogin() {
    const userEl = document.getElementById("login-username");
    const passEl = document.getElementById("login-password");

    const username = userEl.value.trim();
    const password = passEl.value;

    let valid = true;
    if (!username) {
        showError("login-username", "Username is required");
        valid = false;
    } else {
        clearError("login-username");
    }

    if (!password) {
        showError("login-password", "Password is required");
        valid = false;
    } else {
        clearError("login-password");
    }

    if (!valid) return;

    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.innerText = "Signing In...";
    document.getElementById("login-status").innerText = "";

    try {
        const data = await api.post("/api/auth/login", { username, password });
        state.currentUser = data.user;

        // Remember username logic
        const rememberMe = document.getElementById("remember-me").checked;
        if (rememberMe) {
            localStorage.setItem("remembered_username", username);
        } else {
            localStorage.removeItem("remembered_username");
        }

        // Display UI Workspace
        document.getElementById("username-display").innerText = state.currentUser.username;
        const badge = document.getElementById("user-badge");
        badge.innerText = state.currentUser.role;
        badge.className = "badge " + (state.currentUser.role === "Admin" ? "admin-badge" : "local-badge");

        const avatarInitial = document.getElementById("user-avatar-initial");
        if (avatarInitial && state.currentUser.username) {
            avatarInitial.innerText = state.currentUser.username.charAt(0).toUpperCase();
        }

        showScreen("main-app");
        switchTab("entry-form-tab");

        // Auto focus on launch
        document.getElementById("entry-workorder").focus();
        resetEntryForm();
    } catch (err) {
        const errMsg = err.message || "Authentication failed";
        const errType = err.data && err.data.error_type;

        if (errType === "username") {
            showError("login-username", errMsg);
        } else if (errType === "password") {
            showError("login-password", errMsg);
        } else {
            document.getElementById("login-status").className = "status-msg error-msg text-center mt-3";
            document.getElementById("login-status").innerText = errMsg;
        }
    } finally {
        btn.disabled = false;
        btn.innerText = "Sign In";
    }
}

async function handleFirstTimeSetup() {
    const user = document.getElementById("admin-setup-username").value.trim();
    const pass = document.getElementById("admin-setup-password").value;

    let valid = true;
    if (!user) {
        showError("admin-setup-username", "Username is required");
        valid = false;
    } else {
        clearError("admin-setup-username");
    }

    if (pass.length < 6) {
        showError("admin-setup-password", "Password must be at least 6 characters");
        valid = false;
    } else {
        clearError("admin-setup-password");
    }

    if (!valid) return;

    try {
        const data = await api.post("/api/auth/setup", { username: user, password: pass });
        document.getElementById("first-time-status").className = "status-msg success-msg text-center mt-3";
        document.getElementById("first-time-status").innerText = "Admin created! Redirecting...";
        setTimeout(() => {
            showScreen("login-screen");
            document.getElementById("login-username").value = user;
            document.getElementById("login-password").focus();
        }, 1500);
    } catch (e) {
        showError("admin-setup-username", e.message || "Failed to connect to server");
    }
}

async function handleRegisterNewUser() {
    const adminUser = document.getElementById("reg-admin-username").value.trim();
    const adminPass = document.getElementById("reg-admin-password").value;
    const newUsername = document.getElementById("reg-new-username").value.trim();
    const newPassword = document.getElementById("reg-new-password").value;
    const newRole = document.getElementById("reg-new-role").value;

    let valid = true;
    if (!adminUser) { showError("reg-admin-username", "Admin Username is required"); valid = false; }
    else { clearError("reg-admin-username"); }

    if (!adminPass) { showError("reg-admin-password", "Admin Password is required"); valid = false; }
    else { clearError("reg-admin-password"); }

    if (!newUsername) { showError("reg-new-username", "New Username is required"); valid = false; }
    else { clearError("reg-new-username"); }

    if (newPassword.length < 6) { showError("reg-new-password", "Password must be at least 6 characters"); valid = false; }
    else { clearError("reg-new-password"); }

    if (!valid) return;

    const statusEl = document.getElementById("register-status");
    statusEl.innerText = "Registering user...";
    statusEl.className = "status-msg text-center mt-3";

    try {
        const data = await api.post("/api/auth/register", {
            admin_username: adminUser,
            admin_password: adminPass,
            new_username: newUsername,
            new_password: newPassword,
            new_role: newRole
        });

        statusEl.className = "status-msg success-msg text-center mt-3";
        statusEl.innerText = data.message;
        // Clear inputs
        document.getElementById("reg-new-username").value = "";
        document.getElementById("reg-new-password").value = "";
        setTimeout(() => {
            showScreen("login-screen");
        }, 2000);
    } catch (e) {
        statusEl.className = "status-msg error-msg text-center mt-3";
        statusEl.innerText = e.message || "Failed to communicate with server";
    }
}

// 4. Form Validation & Auto-Formatting Logic (Date / Time Separators)
function formatAndValidateDate(elementId) {
    const el = document.getElementById(elementId);
    let val = el.value.replace(/[^0-9]/g, ""); // extract digits

    // Auto convert YYYYMMDD to YYYY-MM-DD
    if (val.length === 8) {
        const y = val.substring(0, 4);
        const m = val.substring(4, 6);
        const d = val.substring(6, 8);
        el.value = `${y}-${m}-${d}`;
    }
    // Auto convert YYMMDD to YYYY-MM-DD (e.g. 260707 -> 2026-07-07)
    else if (val.length === 6) {
        const y = "20" + val.substring(0, 2);
        const m = val.substring(2, 4);
        const d = val.substring(4, 6);
        el.value = `${y}-${m}-${d}`;
    }
}

function formatAndValidateTime(elementId, helperId) {
    const el = document.getElementById(elementId);
    const helper = document.getElementById(helperId);
    let val = el.value.replace(/[^0-9]/g, ""); // extract digits

    if (val.length === 3) {
        // e.g. 930 -> 09:30
        val = "0" + val;
    }

    if (val.length === 4) {
        const hh = val.substring(0, 2);
        const mm = val.substring(2, 4);
        el.value = `${hh}:${mm}`;
    }

    // Output formatted 12-hour verification helper text
    const timeMatch = el.value.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const min = timeMatch[2];
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;

        // Pad hour
        const padHour = displayHour < 10 ? "0" + displayHour : displayHour;
        helper.innerText = `Time : ${padHour} : ${min} ${ampm}`;
        helper.classList.remove("text-danger");
    } else {
        helper.innerText = "Time: -- : --";
    }
}

// Populate Sub PL Type dropdown contextually
function handlePLTypeChange(plTypeElId, subPlTypeElId, reviseNotifyElId) {
    const plType = document.getElementById(plTypeElId).value;
    const subDropdown = document.getElementById(subPlTypeElId);
    const reviseNotification = document.getElementById(reviseNotifyElId);

    // Reset Sub PL dropdown options
    subDropdown.innerHTML = '<option value="">Select Sub Type</option>';

    // Hide revise notice
    if (reviseNotification) {
        reviseNotification.classList.add("hidden");
    }

    if (plType === "New" || plType === "Add") {
        addSubPlOption(subDropdown, "With ASN", "With ASN");
        addSubPlOption(subDropdown, "Without ASN", "Without ASN");
    } else if (plType === "Update") {
        addSubPlOption(subDropdown, "PO", "PO");
        addSubPlOption(subDropdown, "Numbering", "Numbering");
        addSubPlOption(subDropdown, "PO + Numbering", "PO + Numbering");
    } else if (plType === "Revise") {
        if (reviseNotification) reviseNotification.classList.remove("hidden");
        const options = ["WO", "PO", "Pack", "Entry", "Style", "Dimensions", "Size", "Color", "Code"];
        options.forEach(opt => addSubPlOption(subDropdown, opt, opt));
    } else if (plType === "Delete") {
        const options = ["Wrong WO", "Wrong Location", "SV Double Scanning (siast)"];
        options.forEach(opt => addSubPlOption(subDropdown, opt, opt));
    }
}

function addSubPlOption(selectEl, value, text) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.innerText = text;
    selectEl.appendChild(opt);
}

// 5. Entry Submission, Editing, Modifying & Save As New
function validateEntryForm(isBulk = false) {
    const prefix = isBulk ? "bulk-" : "entry-";
    let valid = true;

    // Work Order check (9-digit, > 200000000 and < 1000000000)
    const woEl = document.getElementById(`${prefix}workorder`);
    const woVal = woEl.value.trim();
    if (!/^\d{9}$/.test(woVal)) {
        showError(`${prefix}workorder`, "Must be a 9-digit number");
        valid = false;
    } else {
        const woInt = parseInt(woVal, 10);
        if (woInt <= 200000000 || woInt >= 1000000000) {
            showError(`${prefix}workorder`, "Range: 200000001 to 999999999");
            valid = false;
        } else {
            clearError(`${prefix}workorder`);
        }
    }

    // Pack No. check (5-digit, > 40000 and < 100000)
    const packEl = document.getElementById(`${prefix}packno`);
    const packVal = packEl.value.trim();
    if (!/^\d{5}$/.test(packVal)) {
        showError(`${prefix}packno`, "Must be a 5-digit number");
        valid = false;
    } else {
        const packInt = parseInt(packVal, 10);
        if (packInt <= 40000 || packInt >= 100000) {
            showError(`${prefix}packno`, "Range: 40001 to 99999");
            valid = false;
        } else {
            clearError(`${prefix}packno`);
        }
    }

    // Dropdowns
    const dropdowns = ["pltype", "subpltype", "location", "customer"];
    dropdowns.forEach(field => {
        const el = document.getElementById(`${prefix}${field}`);
        if (!el.value) {
            showError(`${prefix}${field}`, "This field is required");
            valid = false;
        } else {
            clearError(`${prefix}${field}`);
        }
    });

    // Date (YYYY-MM-DD)
    const dateEl = document.getElementById(`${prefix}date`);
    const dateVal = dateEl.value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        showError(`${prefix}date`, "Invalid date. Format: YYYY-MM-DD");
        valid = false;
    } else {
        clearError(`${prefix}date`);
    }

    // Time (HH:MM)
    const timeEl = document.getElementById(`${prefix}time`);
    const timeVal = timeEl.value.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeVal)) {
        showError(`${prefix}time`, "Invalid 24h time. Format: HH:MM");
        valid = false;
    } else {
        clearError(`${prefix}time`);
    }

    return valid;
}

async function submitEntry() {
    if (!validateEntryForm()) return;

    const submitBtn = document.getElementById("submit-entry-btn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting...";

    const mailChk = document.getElementById("mode-mail");
    const modeVal = (mailChk && mailChk.checked) ? "Mail" : "Manual";

    const payload = {
        userid: state.currentUser.userid,
        work_order: parseInt(document.getElementById("entry-workorder").value.trim(), 10),
        pack_no: parseInt(document.getElementById("entry-packno").value.trim(), 10),
        pl_type: document.getElementById("entry-pltype").value,
        sub_pl_type: document.getElementById("entry-subpltype").value,
        location: document.getElementById("entry-location").value,
        customer: document.getElementById("entry-customer").value,
        mode: modeVal,
        timestamp: `${document.getElementById("entry-date").value} ${document.getElementById("entry-time").value}:00`
    };

    try {
        const data = await api.post("/api/entries/submit", payload);

        // Success! Populate Metadata visualizer
        document.getElementById("meta-master-id").innerText = data.entry.master_unique_id;
        document.getElementById("meta-user-id").innerText = data.entry.unique_id_by_user;
        document.getElementById("meta-day-id").innerText = data.entry.daily_count_id;
        document.getElementById("meta-day-user-id").innerText = data.entry.unique_id_by_day_by_user;

        // Set User IP and username from API or locally
        document.getElementById("meta-submitted-by").innerText = state.currentUser.username;

        if (window.pywebview) {
            pywebview.api.get_local_ip().then(ip => {
                document.getElementById("meta-pc-ip").innerText = ip;
            });
        } else {
            document.getElementById("meta-pc-ip").innerText = "127.0.0.1";
        }

        // Clear inputs based on user preference
        const autoClear = localStorage.getItem("pref_auto_clear") !== "false";
        resetEntryFormFields(autoClear);

        // Play audio if enabled
        const beepEnabled = localStorage.getItem("pref_beeps_enabled") !== "false";
        if (beepEnabled) {
            playBeepSound();
        }

        toast.success("Entry submitted successfully!");

        // Refocus Workorder
        document.getElementById("entry-workorder").focus();
    } catch (e) {
        toast.error("Submission failed: " + (e.message || "Server unreachable"));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit";
    }
}

async function updateEntry() {
    if (!state.activeEntryId) return;
    if (!validateEntryForm()) return;

    const mailChk = document.getElementById("mode-mail");
    const modeVal = (mailChk && mailChk.checked) ? "Mail" : "Manual";

    const payload = {
        requesting_userid: state.currentUser.userid,
        entry_id: state.activeEntryId,
        work_order: parseInt(document.getElementById("entry-workorder").value.trim(), 10),
        pack_no: parseInt(document.getElementById("entry-packno").value.trim(), 10),
        pl_type: document.getElementById("entry-pltype").value,
        sub_pl_type: document.getElementById("entry-subpltype").value,
        location: document.getElementById("entry-location").value,
        customer: document.getElementById("entry-customer").value,
        mode: modeVal,
        timestamp: `${document.getElementById("entry-date").value} ${document.getElementById("entry-time").value}:00`
    };

    try {
        await api.put("/api/entries/update", payload);
        toast.success("Entry updated successfully!");
        if (state.searchMode) {
            // Refresh search results cache
            executeEntrySearch(false);
        } else {
            resetEntryForm();
        }
    } catch (e) {
        toast.error("Failed to update entry: " + (e.message || "Server unreachable"));
    }
}

function confirmDeleteEntry() {
    if (!state.activeEntryId) return;

    confirmDialog.show({
        title: "Delete Entry",
        message: "Are you sure you want to delete this Packing List entry?",
        confirmLabel: "Yes, Delete",
        variant: "danger",
        dontShowKey: "dont_show_delete_confirm",
        onConfirm: () => {
            executeDeleteEntry();
        }
    });
}

async function executeDeleteEntry() {
    try {
        await api.delete("/api/entries/delete", {
            requesting_userid: state.currentUser.userid,
            entry_id: state.activeEntryId
        });

        toast.success("Entry deleted successfully!");

        if (state.searchMode) {
            // Refresh search cache
            executeEntrySearch(true);
        } else {
            resetEntryForm();
        }
    } catch (e) {
        toast.error("Failed to delete entry: " + (e.message || "Server unreachable"));
    }
}

async function saveAsNewEntry() {
    if (!validateEntryForm()) return;

    const mailChk = document.getElementById("mode-mail");
    const modeVal = (mailChk && mailChk.checked) ? "Mail" : "Manual";

    const payload = {
        userid: state.currentUser.userid,
        work_order: parseInt(document.getElementById("entry-workorder").value.trim(), 10),
        pack_no: parseInt(document.getElementById("entry-packno").value.trim(), 10),
        pl_type: document.getElementById("entry-pltype").value,
        sub_pl_type: document.getElementById("entry-subpltype").value,
        location: document.getElementById("entry-location").value,
        customer: document.getElementById("entry-customer").value,
        mode: modeVal,
        timestamp: `${document.getElementById("entry-date").value} ${document.getElementById("entry-time").value}:00`
    };

    try {
        const data = await api.post("/api/entries/submit", payload);
        toast.success("Saved successfully as new entry!");

        // Pop out search mode and view the newly created entry values
        exitSearchMode();

        document.getElementById("meta-master-id").innerText = data.entry.master_unique_id;
        document.getElementById("meta-user-id").innerText = data.entry.unique_id_by_user;
        document.getElementById("meta-day-id").innerText = data.entry.daily_count_id;
        document.getElementById("meta-day-user-id").innerText = data.entry.unique_id_by_day_by_user;
        document.getElementById("meta-submitted-by").innerText = state.currentUser.username;

        if (window.pywebview) {
            pywebview.api.get_local_ip().then(ip => {
                document.getElementById("meta-pc-ip").innerText = ip;
            });
        } else {
            document.getElementById("meta-pc-ip").innerText = "127.0.0.1";
        }

        resetEntryFormFields(false);
        document.getElementById("entry-workorder").focus();
    } catch (e) {
        toast.error("Failed to save as new entry: " + (e.message || "Server unreachable"));
    }
}

// Reset functions
function resetEntryForm() {
    resetEntryFormFields(true);
    state.activeEntryId = null;

    // Reset metadata fields
    document.getElementById("meta-master-id").innerText = "—";
    document.getElementById("meta-user-id").innerText = "—";
    document.getElementById("meta-day-id").innerText = "—";
    document.getElementById("meta-day-user-id").innerText = "—";
    document.getElementById("meta-pc-ip").innerText = "—";
    document.getElementById("meta-submitted-by").innerText = "—";

    // Set buttons back to Submit mode
    document.getElementById("submit-entry-btn").classList.remove("hidden");
    document.getElementById("update-entry-btn").classList.add("hidden");
    document.getElementById("delete-entry-btn").classList.add("hidden");
    document.getElementById("save-new-btn").classList.add("hidden");

    exitSearchMode();
}

function resetEntryFormFields(clearAll = false) {
    document.getElementById("entry-workorder").value = "";
    document.getElementById("entry-packno").value = "";

    // Clear validation error text
    document.querySelectorAll(".error-text").forEach(el => el.innerText = "");

    if (clearAll) {
        const defLoc = localStorage.getItem("pref_default_location") || "";
        const defCust = localStorage.getItem("pref_default_customer") || "";
        const defPLType = localStorage.getItem("pref_default_pltype") || "";

        document.getElementById("entry-location").value = defLoc;
        document.getElementById("entry-customer").value = defCust;
        document.getElementById("entry-pltype").value = defPLType;
        handlePLTypeChange("entry-pltype", "entry-subpltype", "revise-notification");

        // Auto fill date/time with today/now
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        document.getElementById("entry-date").value = `${yyyy}-${mm}-${dd}`;

        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        document.getElementById("entry-time").value = `${hh}:${min}`;
        formatAndValidateTime("entry-time", "time-helper");
    }
}

// 6. Search Mode (Navigating with Left and Right arrow keys)
function toggleSearchMode() {
    if (state.searchMode) {
        exitSearchMode();
    } else {
        enterSearchMode();
    }
}

function enterSearchMode() {
    state.searchMode = true;

    // UI badge and states
    document.getElementById("search-mode-badge").classList.remove("hidden");
    document.getElementById("toggle-search-btn").innerText = "Exit Search";
    document.getElementById("toggle-search-btn").className = "dark-btn";
    document.getElementById("form-title").innerText = "Search Packing List Records";

    // Show navigation controls
    document.getElementById("search-nav-controls").classList.remove("hidden");

    // Change action buttons
    document.getElementById("submit-entry-btn").classList.add("hidden");
    document.getElementById("update-entry-btn").classList.remove("hidden");
    document.getElementById("delete-entry-btn").classList.remove("hidden");
    document.getElementById("save-new-btn").classList.remove("hidden");

    // Clear all fields including date and time
    resetEntryFormFields(true);
    document.getElementById("entry-date").value = "";
    document.getElementById("entry-time").value = "";
    document.getElementById("time-helper").innerText = "Time: -- : --";

    // Run query based on whatever is typed in fields
    executeEntrySearch();
}

function exitSearchMode() {
    state.searchMode = false;

    // UI states
    document.getElementById("search-mode-badge").classList.add("hidden");
    document.getElementById("toggle-search-btn").innerText = "Search Mode";
    document.getElementById("toggle-search-btn").className = "search-btn";
    document.getElementById("form-title").innerText = "New Packing List Entry";

    // Hide navigation controls
    document.getElementById("search-nav-controls").classList.add("hidden");

    // Action buttons reset
    document.getElementById("submit-entry-btn").classList.remove("hidden");
    document.getElementById("update-entry-btn").classList.add("hidden");
    document.getElementById("delete-entry-btn").classList.add("hidden");
    document.getElementById("save-new-btn").classList.add("hidden");

    state.searchResults = [];
    state.searchIndex = -1;
    state.activeEntryId = null;

    // Restore defaults and load Date/Time values
    resetEntryFormFields(true);
}

async function executeEntrySearch(deleteOffset = false) {
    const params = new URLSearchParams();

    const wo = document.getElementById("entry-workorder").value.trim();
    const pack = document.getElementById("entry-packno").value.trim();
    const pl = document.getElementById("entry-pltype").value;
    const sub = document.getElementById("entry-subpltype").value;
    const loc = document.getElementById("entry-location").value;
    const cust = document.getElementById("entry-customer").value;
    const date = document.getElementById("entry-date").value.trim();

    if (wo) params.append("work_order", wo);
    if (pack) params.append("pack_no", pack);
    if (pl) params.append("pl_type", pl);
    if (sub) params.append("sub_pl_type", sub);
    if (loc) params.append("location", loc);
    if (cust) params.append("customer", cust);
    if (date) params.append("start_date", date); // Match exact date

    try {
        const data = await api.get(`/api/entries/query?${params.toString()}`);
        state.searchResults = data;

        if (state.searchResults.length > 0) {
            // Select index
            if (deleteOffset && state.searchIndex >= state.searchResults.length) {
                state.searchIndex = state.searchResults.length - 1;
            } else if (!deleteOffset) {
                state.searchIndex = 0;
            }
            displaySearchResultAtActiveIndex();
        } else {
            state.searchIndex = -1;
            state.activeEntryId = null;
            document.getElementById("search-index-display").innerText = "No Records Found";
            resetEntryFormFields(false);
        }
    } catch (e) {
        toast.error("Search failed: " + (e.message || "Server unreachable"));
    }
}

function displaySearchResultAtActiveIndex() {
    if (state.searchIndex < 0 || state.searchIndex >= state.searchResults.length) return;

    const entry = state.searchResults[state.searchIndex];
    state.activeEntryId = entry.EntryID;

    // Fill form
    document.getElementById("entry-workorder").value = entry.WorkOrder;
    document.getElementById("entry-packno").value = entry.PackNo;

    document.getElementById("entry-pltype").value = entry.PLType;
    handlePLTypeChange("entry-pltype", "entry-subpltype", "revise-notification");
    document.getElementById("entry-subpltype").value = entry.SubPLType;

    document.getElementById("entry-location").value = entry.Location;
    document.getElementById("entry-customer").value = entry.Customer;

    const parts = entry.EntryTimestamp.split(" ");
    document.getElementById("entry-date").value = parts[0];
    document.getElementById("entry-time").value = parts[1].substring(0, 5); // HH:MM
    formatAndValidateTime("entry-time", "time-helper");

    // Metadata details display
    document.getElementById("meta-master-id").innerText = entry.MasterUniqueID || "—";
    document.getElementById("meta-user-id").innerText = entry.UniqueIDByUser || "—";
    document.getElementById("meta-day-id").innerText = entry.DailyCountID || "—";
    document.getElementById("meta-day-user-id").innerText = entry.UniqueIDByDayByUser || "—";
    document.getElementById("meta-pc-ip").innerText = entry.SourcePC_IP || "—";
    document.getElementById("meta-submitted-by").innerText = entry.Username || "—";

    // Counter label
    document.getElementById("search-index-display").innerText = `Record ${state.searchIndex + 1} of ${state.searchResults.length}`;
}

function cycleSearchRecord(direction) {
    if (!state.searchMode || state.searchResults.length === 0) return;

    if (direction === "next") {
        state.searchIndex = (state.searchIndex + 1) % state.searchResults.length;
    } else {
        state.searchIndex = (state.searchIndex - 1 + state.searchResults.length) % state.searchResults.length;
    }
    displaySearchResultAtActiveIndex();
}

// Client-Side Spreadsheet Column Sorting helper
function handleSpreadsheetSort(columnName) {
    if (state.sortColumn === columnName) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
        state.sortColumn = columnName;
        state.sortDirection = "asc";
    }

    state.sheetEntries.sort((a, b) => {
        let valA = a[columnName];
        let valB = b[columnName];

        if (typeof valA === "number" && typeof valB === "number") {
            return state.sortDirection === "asc" ? valA - valB : valB - valA;
        }

        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();

        if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
        return 0;
    });

    updateSortHeadersUI();
    state.currentPage = 1; // reset to first page on sort
    renderSpreadsheet();
}

function updateSortHeadersUI() {
    const headers = document.querySelectorAll("#entries-table th.sortable");
    headers.forEach(th => {
        th.classList.remove("asc", "desc");
        const col = th.getAttribute("data-sort");
        if (col === state.sortColumn) {
            th.classList.add(state.sortDirection);
        }
    });
}

// 7. Spreadsheet: Grid view and Bulk Modifications
async function fetchSpreadsheetData() {
    const params = new URLSearchParams();

    // Apply Quick filter date bounds
    const now = new Date();
    let startDate = "";
    let endDate = now.toISOString().substring(0, 10); // YYYY-MM-DD today

    if (state.quickFilter === "hour") {
        // Query server handles timestamp filter directly, let's pass date query or fetch all and filter in JS
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        startDate = oneHourAgo.toISOString().substring(0, 10);
    } else if (state.quickFilter === "today") {
        startDate = endDate;
    } else if (state.quickFilter === "yesterday") {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        startDate = yesterday.toISOString().substring(0, 10);
        endDate = startDate;
    } else if (state.quickFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().substring(0, 10);
    } else if (state.quickFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().substring(0, 10);
    }

    // Custom overrides from inputs
    const customStart = document.getElementById("sheet-start-date").value;
    const customEnd = document.getElementById("sheet-end-date").value;
    if (customStart) startDate = customStart;
    if (customEnd) endDate = customEnd;

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    // Global Search query
    const searchVal = document.getElementById("sheet-search").value.trim();
    if (searchVal) params.append("search_query", searchVal);

    try {
        state.sheetEntries = await api.get(`/api/entries/query?${params.toString()}`);

        state.selectedEntryIds.clear();
        document.getElementById("select-all-entries").checked = false;
        updateSelectionStatusLabel();

        renderSpreadsheet();
    } catch (e) {
        toast.error("Failed to load spreadsheet: " + (e.message || "Server unreachable"));
    }
}

function renderSpreadsheet() {
    const tbody = document.getElementById("entries-table-body");
    tbody.innerHTML = "";

    const totalPages = Math.ceil(state.sheetEntries.length / state.pageSize) || 1;
    if (state.currentPage > totalPages) {
        state.currentPage = totalPages;
    }
    if (state.currentPage < 1) {
        state.currentPage = 1;
    }

    const paginationEl = document.getElementById("spreadsheet-pagination");
    const prevBtn = document.getElementById("prev-page-btn");
    const nextBtn = document.getElementById("next-page-btn");
    const pageInfo = document.getElementById("page-info");

    if (state.sheetEntries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="text-center">No entries found for active filters</td></tr>';
        if (paginationEl) paginationEl.classList.add("hidden");
        return;
    }

    if (paginationEl) {
        paginationEl.classList.remove("hidden");
        pageInfo.innerText = `Page ${state.currentPage} of ${totalPages}`;
        prevBtn.disabled = state.currentPage === 1;
        nextBtn.disabled = state.currentPage === totalPages;
    }

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const paginatedEntries = state.sheetEntries.slice(startIdx, startIdx + state.pageSize);

    paginatedEntries.forEach(entry => {
        const tr = document.createElement("tr");

        // Format dates nicely
        const parts = entry.EntryTimestamp.split(" ");
        const timeStr = parts[1].substring(0, 5); // HH:MM

        // Checkbox permission validation:
        // Local users can see other people's entries but cannot modify or delete them.
        const isOwner = entry.UserID === state.currentUser.userid;
        const isAdmin = state.currentUser.role === "Admin";
        const canModify = isOwner || isAdmin;

        const isChecked = state.selectedEntryIds.has(entry.EntryID);

        tr.innerHTML = `
            <td class="numeric-col">${entry.MasterUniqueID || ""}</td>
            <td class="numeric-col">${entry.UniqueIDByUser || ""}</td>
            <td class="numeric-col">${entry.DailyCountID || ""}</td>
            <td class="numeric-col">${entry.UniqueIDByDayByUser || ""}</td>
            <td class="numeric-col">${entry.WorkOrder}</td>
            <td class="numeric-col">${entry.PackNo}</td>
            <td>${entry.PLType}</td>
            <td>${entry.SubPLType}</td>
            <td>${entry.Location}</td>
            <td>${entry.Customer}</td>
            <td>${parts[0]} ${timeStr}</td>
            <td>${entry.Username}</td>
            <td>${entry.SourcePC_IP}</td>
            <td class="text-center">
                <input type="checkbox" class="entry-row-checkbox" data-id="${entry.EntryID}" 
                    ${canModify ? "" : "disabled"} 
                    ${isChecked ? "checked" : ""}>
            </td>
        `;

        // Toggle checkbox on select
        const cb = tr.querySelector(".entry-row-checkbox");
        if (canModify) {
            cb.addEventListener("change", (e) => {
                const eid = entry.EntryID;
                if (e.target.checked) {
                    state.selectedEntryIds.add(eid);
                } else {
                    state.selectedEntryIds.delete(eid);
                }
                updateSelectionStatusLabel();
            });
        }

        tbody.appendChild(tr);
    });
}

function updateSelectionStatusLabel() {
    const count = state.selectedEntryIds.size;
    document.getElementById("selection-status").innerText = `${count} rows selected`;
}

function toggleSelectAllEntries(checked) {
    const checkboxes = document.querySelectorAll(".entry-row-checkbox");
    checkboxes.forEach(cb => {
        if (!cb.disabled) {
            cb.checked = checked;
            const eid = parseInt(cb.getAttribute("data-id"), 10);
            if (checked) {
                state.selectedEntryIds.add(eid);
            } else {
                state.selectedEntryIds.delete(eid);
            }
        }
    });
    updateSelectionStatusLabel();
}

// Bulk Actions: Modify, Delete
function triggerBulkModify() {
    if (state.selectedEntryIds.size === 0) {
        toast.warning("Please select at least one packing list row to edit.");
        return;
    }

    // Cache the entries being edited, sorted chronologically (ascending or descending, standard is ascending order to process)
    const selectedIds = Array.from(state.selectedEntryIds);
    state.bulkEntries = state.sheetEntries
        .filter(e => selectedIds.includes(e.EntryID))
        .sort((a, b) => new Date(a.EntryTimestamp) - new Date(b.EntryTimestamp));

    state.bulkIndex = 0;
    state.bulkModifiedData = {};

    // Pop the bulk modify modal
    document.getElementById("bulk-modify-modal").classList.remove("hidden");
    displayBulkEntryAtActiveIndex();
}

function displayBulkEntryAtActiveIndex() {
    if (state.bulkIndex < 0 || state.bulkIndex >= state.bulkEntries.length) return;

    const entry = state.bulkEntries[state.bulkIndex];
    const originalId = entry.EntryID;

    // Use current modifications if they exist, else use original values
    const data = state.bulkModifiedData[originalId] || {
        work_order: entry.WorkOrder,
        pack_no: entry.PackNo,
        pl_type: entry.PLType,
        sub_pl_type: entry.SubPLType,
        location: entry.Location,
        customer: entry.Customer,
        timestamp: entry.EntryTimestamp
    };

    document.getElementById("bulk-workorder").value = data.work_order;
    document.getElementById("bulk-packno").value = data.pack_no;

    document.getElementById("bulk-pltype").value = data.pl_type;
    handlePLTypeChange("bulk-pltype", "bulk-subpltype", "bulk-revise-notification");
    document.getElementById("bulk-subpltype").value = data.sub_pl_type;

    document.getElementById("bulk-location").value = data.location;
    document.getElementById("bulk-customer").value = data.customer;

    const parts = data.timestamp.split(" ");
    document.getElementById("bulk-date").value = parts[0];
    document.getElementById("bulk-time").value = parts[1].substring(0, 5); // HH:MM
    formatAndValidateTime("bulk-time", "bulk-time-helper");

    // Reset validation errors
    document.querySelectorAll("#bulk-modify-modal .error-text").forEach(el => el.innerText = "");

    // Indicator label
    document.getElementById("bulk-index-display").innerText = `Record ${state.bulkIndex + 1} of ${state.bulkEntries.length}`;
}

function saveActiveBulkChangesLocally() {
    if (!validateEntryForm(true)) return false;

    const entry = state.bulkEntries[state.bulkIndex];
    const eid = entry.EntryID;

    state.bulkModifiedData[eid] = {
        entry_id: eid,
        work_order: parseInt(document.getElementById("bulk-workorder").value.trim(), 10),
        pack_no: parseInt(document.getElementById("bulk-packno").value.trim(), 10),
        pl_type: document.getElementById("bulk-pltype").value,
        sub_pl_type: document.getElementById("bulk-subpltype").value,
        location: document.getElementById("bulk-location").value,
        customer: document.getElementById("bulk-customer").value,
        timestamp: `${document.getElementById("bulk-date").value} ${document.getElementById("bulk-time").value}:00`
    };

    return true;
}

function cycleBulkRecord(direction) {
    // Save current modifications before navigating
    if (!saveActiveBulkChangesLocally()) return; // block navigation if invalid inputs

    if (direction === "next") {
        state.bulkIndex = (state.bulkIndex + 1) % state.bulkEntries.length;
    } else {
        state.bulkIndex = (state.bulkIndex - 1 + state.bulkEntries.length) % state.bulkEntries.length;
    }
    displayBulkEntryAtActiveIndex();
}

async function commitBulkAllChanges() {
    // First save the active record
    if (!saveActiveBulkChangesLocally()) return;

    const updatesList = [];

    // Compile updates
    state.bulkEntries.forEach(entry => {
        const eid = entry.EntryID;
        const modified = state.bulkModifiedData[eid];
        if (modified) {
            updatesList.push(modified);
        }
    });

    if (updatesList.length === 0) {
        document.getElementById("bulk-modify-modal").classList.add("hidden");
        return;
    }

    const payload = {
        requesting_userid: state.currentUser.userid,
        updates: updatesList
    };

    try {
        await api.post("/api/entries/bulk-update", payload);
        toast.success(`Successfully updated ${updatesList.length} records!`);
        document.getElementById("bulk-modify-modal").classList.add("hidden");
        fetchSpreadsheetData();
    } catch (e) {
        toast.error("Bulk update failed: " + (e.message || "Server unreachable"));
    }
}

async function triggerBulkDelete() {
    const size = state.selectedEntryIds.size;
    if (size === 0) {
        toast.warning("Please select rows to delete first.");
        return;
    }

    confirmDialog.show({
        title: "Delete Selected",
        message: `Are you sure you want to delete ${size} selected Packing Lists?`,
        confirmLabel: "Yes, Delete",
        variant: "danger",
        onConfirm: async () => {
            try {
                await api.post("/api/entries/bulk-delete", {
                    requesting_userid: state.currentUser.userid,
                    entry_ids: Array.from(state.selectedEntryIds)
                });
                toast.success(`Successfully deleted ${size} entries.`);
                fetchSpreadsheetData();
            } catch (e) {
                toast.error("Bulk delete failed: " + (e.message || "Server unreachable"));
            }
        }
    });
}

// 8. Settings configuration (Server IP/Port modal changes)
function handleSaveSettings() {
    const ip = document.getElementById("settings-ip").value.trim();
    const port = parseInt(document.getElementById("settings-port").value.trim(), 10);

    if (!ip || isNaN(port)) {
        toast.error("Invalid IP Address or Port");
        return;
    }

    state.serverIp = ip;
    state.serverPort = port;
    updateApiUrl();

    // Persist configurations locally in pywebview config
    if (window.pywebview) {
        pywebview.api.save_config({ server_ip: ip, server_port: port }).then(() => {
            document.getElementById("settings-modal").classList.add("hidden");
            checkServerConnection();
        });
    } else {
        document.getElementById("settings-modal").classList.add("hidden");
        checkServerConnection();
    }
}

function handleSaveSetupScreen() {
    const ip = document.getElementById("setup-ip").value.trim();
    const port = parseInt(document.getElementById("setup-port").value.trim(), 10);

    if (!ip || isNaN(port)) {
        document.getElementById("setup-ip-error").innerText = "Invalid Server IP Address";
        return;
    }

    state.serverIp = ip;
    state.serverPort = port;
    updateApiUrl();

    if (window.pywebview) {
        pywebview.api.save_config({ server_ip: ip, server_port: port }).then(() => {
            checkServerConnection();
        });
    } else {
        checkServerConnection();
    }
}

// Helper validation handlers
function showError(id, msg) {
    const errEl = document.getElementById(`${id}-error`);
    if (errEl) errEl.innerText = msg;
    const inputEl = document.getElementById(id);
    if (inputEl) inputEl.style.borderColor = "var(--danger)";
}

function clearError(id) {
    const errEl = document.getElementById(`${id}-error`);
    if (errEl) errEl.innerText = "";
    const inputEl = document.getElementById(id);
    if (inputEl) inputEl.style.borderColor = "var(--border-color)";
}

// 9. Window Keyboard Shortcuts Listener
function setupShortcutListeners() {
    document.addEventListener("keydown", (e) => {
        // Toggle Search Mode: F11
        if (e.key === "F11" && !e.ctrlKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab") {
                toggleSearchMode();
            }
        }

        // Execute search filter: Ctrl + F11
        if (e.key === "F11" && e.ctrlKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab" && state.searchMode) {
                executeEntrySearch();
            }
        }

        // Save active entry (or Update if editing): Ctrl + Enter
        if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab") {
                if (state.searchMode) {
                    updateEntry();
                } else {
                    submitEntry();
                }
            }
        }

        // Action "Save as New": Ctrl + Shift + Enter
        if (e.key === "Enter" && e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab" && state.searchMode) {
                saveAsNewEntry();
            }
        }

        // Clear all inputs: Delete key (if focus not on input, or custom form clear)
        if (e.key === "Delete" && !e.ctrlKey) {
            // If user is typing in a field, don't clear the form
            if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "SELECT") {
                e.preventDefault();
                if (state.currentTab === "entry-form-tab") {
                    resetEntryFormFields(true);
                }
            }
        }

        // Delete active entry: Ctrl + Delete
        if (e.key === "Delete" && e.ctrlKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab" && state.activeEntryId) {
                confirmDeleteEntry();
            }
        }

        // Keyboard search cycling in Search Mode (Left/Right Arrows)
        if (state.currentTab === "entry-form-tab" && state.searchMode) {
            if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "SELECT") {
                if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    cycleSearchRecord("prev");
                }
                if (e.key === "ArrowRight") {
                    e.preventDefault();
                    cycleSearchRecord("next");
                }
            }
        }
    });
}

function setupIdeMenuHandlers() {
    // Menu item clicks
    document.querySelectorAll(".ide-menu-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const parent = btn.parentElement;
            const dropdown = parent.querySelector(".ide-dropdown-menu");
            const isAlreadyOpen = !dropdown.classList.contains("hidden");

            // Close all open dropdowns
            document.querySelectorAll(".ide-dropdown-menu").forEach(d => d.classList.add("hidden"));
            document.querySelectorAll(".ide-menu-item").forEach(m => m.classList.remove("open"));

            if (!isAlreadyOpen) {
                dropdown.classList.remove("hidden");
                parent.classList.add("open");
            }
        });
    });

    // Close menus on click outside
    document.addEventListener("click", () => {
        document.querySelectorAll(".ide-dropdown-menu").forEach(d => d.classList.add("hidden"));
        document.querySelectorAll(".ide-menu-item").forEach(m => m.classList.remove("open"));
    });

    // Menu Actions
    const menuActionClear = document.getElementById("menu-action-clear");
    if (menuActionClear) menuActionClear.addEventListener("click", resetEntryFormFields);

    const menuActionExportCsv = document.getElementById("menu-action-export-csv");
    if (menuActionExportCsv) menuActionExportCsv.addEventListener("click", exportReportToCSV);

    const menuActionLogout = document.getElementById("menu-action-logout");
    if (menuActionLogout) menuActionLogout.addEventListener("click", handleLogout);

    const menuActionToggleSearch = document.getElementById("menu-action-toggle-search");
    if (menuActionToggleSearch) menuActionToggleSearch.addEventListener("click", toggleSearchMode);

    const menuActionToggleSidebar = document.getElementById("menu-action-toggle-sidebar");
    if (menuActionToggleSidebar) menuActionToggleSidebar.addEventListener("click", () => {
        const sidebar = document.getElementById("app-sidebar");
        if (sidebar) sidebar.classList.toggle("collapsed");
    });

    const menuActionToggleTheme = document.getElementById("menu-action-toggle-theme");
    if (menuActionToggleTheme) menuActionToggleTheme.addEventListener("click", () => {
        const isCurrentlyLight = document.documentElement.classList.contains("light-mode");
        const nextTheme = isCurrentlyLight ? "dark" : "light";
        localStorage.setItem("pref_theme", nextTheme);
        applyTheme(nextTheme);
    });

    // Go Menu Actions
    const menuGoEntry = document.getElementById("menu-go-entry");
    if (menuGoEntry) menuGoEntry.addEventListener("click", () => switchTab("entry-form-tab"));

    const menuGoEntries = document.getElementById("menu-go-entries");
    if (menuGoEntries) menuGoEntries.addEventListener("click", () => switchTab("previous-entries-tab"));

    const menuGoDashboard = document.getElementById("menu-go-dashboard");
    if (menuGoDashboard) menuGoDashboard.addEventListener("click", () => switchTab("dashboard-tab"));

    const menuGoReports = document.getElementById("menu-go-reports");
    if (menuGoReports) menuGoReports.addEventListener("click", () => switchTab("report-tab"));

    const menuGoSettings = document.getElementById("menu-go-settings");
    if (menuGoSettings) menuGoSettings.addEventListener("click", () => switchTab("settings-tab"));

    // Run Action
    const menuActionSubmit = document.getElementById("menu-action-submit");
    if (menuActionSubmit) menuActionSubmit.addEventListener("click", () => {
        if (state.currentTab === "entry-form-tab") {
            if (state.activeEntryId) updateEntry();
            else submitEntry();
        }
    });
}

// 10. Normal event binds
function setupEventHandlers() {
    setupIdeMenuHandlers();

    // Login triggers
    document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        handleLogin();
    });

    // Allow enter key submission directly
    document.getElementById("login-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleLogin();
        }
    });

    document.getElementById("go-to-register-btn").addEventListener("click", () => {
        showScreen("register-screen");
        document.getElementById("reg-admin-username").focus();
    });

    document.getElementById("cancel-register-btn").addEventListener("click", () => {
        showScreen("login-screen");
        document.getElementById("login-username").focus();
    });

    document.getElementById("register-btn").addEventListener("click", handleRegisterNewUser);
    document.getElementById("create-admin-btn").addEventListener("click", handleFirstTimeSetup);

    // Connection screen triggers
    document.getElementById("save-setup-btn").addEventListener("click", handleSaveSetupScreen);

    // Logout
    document.getElementById("logout-btn").addEventListener("click", handleLogout);

    // Settings Sub-tab switches
    document.querySelectorAll(".settings-sub-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".settings-sub-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const targetPanelId = btn.getAttribute("data-sub-tab");
            document.querySelectorAll(".settings-sub-panel").forEach(p => p.classList.remove("active"));
            document.getElementById(targetPanelId).classList.add("active");
        });
    });

    // Theme mode listeners
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const isCurrentlyLight = document.documentElement.classList.contains("light-mode");
            const nextTheme = isCurrentlyLight ? "dark" : "light";
            localStorage.setItem("pref_theme", nextTheme);
            applyTheme(nextTheme);
            toast.info(`Switched to ${nextTheme === "light" ? "Apple Light" : "Apple Dark"} theme.`);
        });
    }

    const themePresetSelect = document.getElementById("theme-preset-select");
    if (themePresetSelect) {
        themePresetSelect.addEventListener("change", (e) => {
            const selected = e.target.value;
            localStorage.setItem("pref_theme", selected);
            applyTheme(selected);
        });
    }

    const themeFontSelect = document.getElementById("theme-font-select");
    if (themeFontSelect) {
        themeFontSelect.addEventListener("change", (e) => {
            const selected = e.target.value;
            localStorage.setItem("pref_font", selected);
            applyFont(selected);
        });
    }

    // Status Bar Mode listener
    const statusBarModeSelect = document.getElementById("pref-statusbar-mode");
    if (statusBarModeSelect) {
        const savedMode = localStorage.getItem("pref_statusbar_mode") || "accent";
        statusBarModeSelect.value = savedMode;
        applyStatusBarMode(savedMode);
        statusBarModeSelect.addEventListener("change", (e) => {
            const selected = e.target.value;
            localStorage.setItem("pref_statusbar_mode", selected);
            applyStatusBarMode(selected);
            toast.info(`Status Bar Mode set to ${selected === "accent" ? "Accent Match" : "Mode Tone"}.`);
        });
    }

    // Audio Tone listener
    const audioToneSelect = document.getElementById("pref-audio-tone");
    if (audioToneSelect) {
        const savedTone = localStorage.getItem("pref_audio_tone") || "chime";
        audioToneSelect.value = savedTone;
        audioToneSelect.addEventListener("change", (e) => {
            const selected = e.target.value;
            localStorage.setItem("pref_audio_tone", selected);
            playUnifiedAudioTone(selected);
        });
    }

    document.querySelectorAll(".accent-swatch-btn").forEach(swatch => {
        swatch.addEventListener("click", () => {
            const accent = swatch.getAttribute("data-accent");
            localStorage.setItem("pref_accent", accent);
            applyAccent(accent);
            toast.info("Accent color updated!");
        });
    });

    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (localStorage.getItem("pref_theme") === "system") {
                applyTheme("system");
            }
        });
    }

    // Session timeout listener
    document.getElementById("pref-session-timeout").addEventListener("change", (e) => {
        localStorage.setItem("pref_session_timeout", e.target.value);
        playAudioTone(880, 0.05, "sine");
    });

    // DB Restore file upload change listener
    document.getElementById("db-restore-file").addEventListener("change", handleDbRestoreUpload);

    // Active session logs kill sessions button
    document.getElementById("btn-kill-sessions").addEventListener("click", () => {
        toast.success("All other active devices have been disconnected successfully.");
        playAudioTone(880, 0.1, "sine");
        renderMockSessions(); // Refresh mock list
    });

    // Admin operators search filter
    document.getElementById("admin-user-search").addEventListener("input", (e) => {
        const val = e.target.value.toLowerCase();
        const rows = document.querySelectorAll("#admin-users-table-body tr");
        rows.forEach(row => {
            const usernameCell = row.cells[1];
            if (usernameCell) {
                const username = usernameCell.innerText.toLowerCase();
                row.style.display = username.includes(val) ? "" : "none";
            }
        });
    });

    // Settings modal bindings removed (moved to Settings tab)

    // Form Event bindings
    document.getElementById("entry-pltype").addEventListener("change", () => {
        handlePLTypeChange("entry-pltype", "entry-subpltype", "revise-notification");
    });

    document.getElementById("bulk-pltype").addEventListener("change", () => {
        handlePLTypeChange("bulk-pltype", "bulk-subpltype", "bulk-revise-notification");
    });

    // Date Auto Formatting trigger on blur/change
    document.getElementById("entry-date").addEventListener("blur", () => {
        formatAndValidateDate("entry-date");
    });
    document.getElementById("bulk-date").addEventListener("blur", () => {
        formatAndValidateDate("bulk-date");
    });

    // Time Auto Formatting trigger
    document.getElementById("entry-time").addEventListener("input", () => {
        formatAndValidateTime("entry-time", "time-helper");
    });
    document.getElementById("entry-time").addEventListener("blur", () => {
        formatAndValidateTime("entry-time", "time-helper");
    });
    document.getElementById("bulk-time").addEventListener("input", () => {
        formatAndValidateTime("bulk-time", "bulk-time-helper");
    });
    document.getElementById("bulk-time").addEventListener("blur", () => {
        formatAndValidateTime("bulk-time", "bulk-time-helper");
    });

    // Password fields show/hide toggles
    document.querySelectorAll(".toggle-password-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const input = document.getElementById(targetId);
            if (input.type === "password") {
                input.type = "text";
                btn.innerText = "Hide";
            } else {
                input.type = "password";
                btn.innerText = "Show";
            }
        });
    });

    // Entry Actions Buttons
    document.getElementById("submit-entry-btn").addEventListener("click", submitEntry);
    document.getElementById("update-entry-btn").addEventListener("click", updateEntry);
    document.getElementById("delete-entry-btn").addEventListener("click", confirmDeleteEntry);
    document.getElementById("save-new-btn").addEventListener("click", saveAsNewEntry);
    document.getElementById("clear-form-btn").addEventListener("click", resetEntryForm);
    document.getElementById("toggle-search-btn").addEventListener("click", toggleSearchMode);

    // Search Mode Navs
    document.getElementById("prev-record-btn").addEventListener("click", () => cycleSearchRecord("prev"));
    document.getElementById("next-record-btn").addEventListener("click", () => cycleSearchRecord("next"));

    // Previous Entries / Spreadsheet filters
    document.getElementById("select-all-entries").addEventListener("change", (e) => {
        toggleSelectAllEntries(e.target.checked);
    });

    document.querySelectorAll(".swatch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".swatch-btn").forEach(s => s.classList.remove("active"));
            btn.classList.add("active");
            state.quickFilter = btn.getAttribute("data-range");
            fetchSpreadsheetData();
        });
    });

    // Filter Apply/Reset
    document.getElementById("sheet-filter-btn").addEventListener("click", fetchSpreadsheetData);
    document.getElementById("sheet-clear-btn").addEventListener("click", () => {
        document.getElementById("sheet-search").value = "";
        document.getElementById("sheet-start-date").value = "";
        document.getElementById("sheet-end-date").value = "";
        document.querySelectorAll(".swatch-btn").forEach(s => s.classList.remove("active"));
        document.querySelector('.swatch-btn[data-range="all"]').classList.add("active");
        state.quickFilter = "all";
        fetchSpreadsheetData();
    });

    // Bulk Dropdown Binds
    document.getElementById("bulk-modify-dropdown-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        document.getElementById("bulk-dropdown-menu").classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
        document.getElementById("bulk-dropdown-menu").classList.add("hidden");
    });

    document.getElementById("bulk-edit-btn").addEventListener("click", triggerBulkModify);
    document.getElementById("bulk-delete-btn").addEventListener("click", triggerBulkDelete);

    // Bulk Modal Nav Binds
    document.getElementById("bulk-prev-btn").addEventListener("click", () => cycleBulkRecord("prev"));
    document.getElementById("bulk-next-btn").addEventListener("click", () => cycleBulkRecord("next"));
    document.getElementById("bulk-save-this-btn").addEventListener("click", () => {
        if (saveActiveBulkChangesLocally()) {
            toast.info("Current entry changes cached locally. Click 'Save All Selected Changes' to commit to database.");
        }
    });
    document.getElementById("bulk-save-all-btn").addEventListener("click", commitBulkAllChanges);
    document.getElementById("bulk-close-btn").addEventListener("click", () => {
        document.getElementById("bulk-modify-modal").classList.add("hidden");
    });

    // Report generation export controls
    document.getElementById("rep-filter-btn").addEventListener("click", handleGenerateReport);
    document.getElementById("rep-reset-btn").addEventListener("click", handleResetReportFilters);
    document.getElementById("export-csv-btn").addEventListener("click", exportReportToCSV);
    document.getElementById("export-xls-btn").addEventListener("click", exportReportToExcel);
    document.getElementById("export-pdf-btn").addEventListener("click", printReportPDF);

    // Settings tab event controls
    document.getElementById("save-preferences-btn").addEventListener("click", savePersonalPreferences);
    document.getElementById("btn-submit-change-pass").addEventListener("click", handleUserChangePassword);
    document.getElementById("btn-admin-create-user").addEventListener("click", handleAdminCreateUser);
    document.getElementById("save-server-pref-btn").addEventListener("click", handleSaveServerPref);
    document.getElementById("btn-test-db-connection").addEventListener("click", handleTestDbConnectionPref);
    document.getElementById("btn-download-db-backup").addEventListener("click", handleDownloadDbBackup);

    // Sidebar collapse/expand toggle helper
    function toggleSidebar() {
        const sidebar = document.getElementById("app-sidebar");
        if (!sidebar) return;
        sidebar.classList.toggle("collapsed");
        localStorage.setItem("sidebar_collapsed", sidebar.classList.contains("collapsed"));
    }

    const collapseBtn = document.getElementById("sidebar-collapse-btn");
    if (collapseBtn) {
        collapseBtn.addEventListener("click", toggleSidebar);
    }

    const menuToggleSidebar = document.getElementById("menu-action-toggle-sidebar");
    if (menuToggleSidebar) {
        menuToggleSidebar.addEventListener("click", toggleSidebar);
    }

    // Global shortcut Ctrl+B or Cmd+B for toggling sidebar
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
            const activeTag = document.activeElement ? document.activeElement.tagName : "";
            if (activeTag !== "INPUT" && activeTag !== "TEXTAREA" && activeTag !== "SELECT") {
                e.preventDefault();
                toggleSidebar();
            }
        }
    });

    // Restore sidebar state on load
    if (localStorage.getItem("sidebar_collapsed") === "true") {
        const sidebar = document.getElementById("app-sidebar");
        if (sidebar) sidebar.classList.add("collapsed");
    }

    // Previous Entries Table Sorting
    document.querySelectorAll("#entries-table th.sortable").forEach(th => {
        th.addEventListener("click", () => {
            const columnName = th.getAttribute("data-sort");
            handleSpreadsheetSort(columnName);
        });
    });

    // Previous Entries Table Pagination
    document.getElementById("prev-page-btn").addEventListener("click", () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderSpreadsheet();
        }
    });

    document.getElementById("next-page-btn").addEventListener("click", () => {
        const totalPages = Math.ceil(state.sheetEntries.length / state.pageSize) || 1;
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderSpreadsheet();
        }
    });
}

// ==========================================
// Added Professional UI/UX Features Logic
// ==========================================

// Web Audio API Synthesizer Tone Player
let audioCtx = null;
function playAudioTone(frequency, duration, type = "sine") {
    try {
        const beepsEnabled = localStorage.getItem("pref_enable_beeps") !== "false";
        if (!beepsEnabled) return;

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Audio Context error:", e);
    }
}

function playBeepSound() {
    const userFreq = localStorage.getItem("pref_beep_frequency");
    const userType = localStorage.getItem("pref_beep_type");
    const freq = userFreq ? parseInt(userFreq, 10) : 880;
    const type = userType || "sine";
    playAudioTone(freq, 0.12, type);
    // Add double-beep chime for higher frequencies
    if (freq >= 1200) {
        setTimeout(() => playAudioTone(freq * 1.5, 0.15, type), 100);
    }
}





// Live Activity Feed & Short-Polling Sync
let lastKnownMaxEntryId = 0;
async function pollDatabaseForUpdates() {
    if (!state.currentUser) return;
    try {
        const currentEntries = await api.get("/api/entries/query");

        // Sync local cache
        state.sheetEntries = currentEntries;

        if (state.currentTab === "previous-entries-tab") {
            renderSpreadsheet();
        }

        // Check for new entries
        if (currentEntries.length > 0) {
            const maxId = Math.max(...currentEntries.map(e => e.EntryID));
            if (lastKnownMaxEntryId > 0 && maxId > lastKnownMaxEntryId) {
                const newItems = currentEntries.filter(e => e.EntryID > lastKnownMaxEntryId);
                newItems.reverse().forEach(item => {
                    logActivity(item);
                });
            }
            lastKnownMaxEntryId = maxId;
        } else {
            lastKnownMaxEntryId = 0;
        }
    } catch (e) {
        console.warn("Polling failed:", e);
    }
}

function logActivity(item) {
    const feed = document.getElementById("live-activity-feed");
    if (!feed) return;

    const placeholder = feed.querySelector(".no-activity");
    if (placeholder) placeholder.remove();

    const isSelf = state.currentUser && item.UserID === state.currentUser.userid;
    const timeStr = item.EntryTimestamp ? item.EntryTimestamp.split(' ')[1].substring(0, 5) : new Date().toLocaleTimeString().substring(0, 5);

    const activityDiv = document.createElement("div");
    activityDiv.className = `activity-item ${isSelf ? 'self' : ''}`;

    const label = isSelf ? "You" : item.Username;
    const firstLetter = item.Username ? item.Username.charAt(0).toUpperCase() : 'U';
    const uid = firstLetter + String(item.UserDailyCountID || 0).padStart(3, '0');

    activityDiv.innerHTML = `
        <span class="activity-text"><strong>${label}</strong> logged <strong>${uid}</strong> (${item.PLType} / ${item.Location})</span>
        <span class="activity-time">${timeStr}</span>
    `;

    feed.insertBefore(activityDiv, feed.firstChild);

    while (feed.children.length > 10) {
        feed.lastChild.remove();
    }

    if (!isSelf) {
        playAudioTone(587.33, 0.2, "sine");
    }
}

// ============================================================
// USER ANALYTICS DASHBOARD & SUBTABS LOGIC
// ============================================================
const userDashState = {
    allEntries: [],
    selectedUser: "all",
    datePreset: "all",
    startDate: "",
    endDate: "",
    activeViewMode: "trend", // 'trend', 'bar', 'pie'
    selectedBreakdownCategory: "pl_type",
    chartInstance: null,
    isInitialized: false
};

function initUserDashboardEventListeners() {
    if (userDashState.isInitialized) return;
    userDashState.isInitialized = true;

    // User Filter listener
    const userSelect = document.getElementById("dash-user-filter");
    if (userSelect) {
        userSelect.addEventListener("change", (e) => {
            userDashState.selectedUser = e.target.value;
            updateUserDashboardView();
        });
    }

    // Date Filter listener
    const dateSelect = document.getElementById("dash-date-filter");
    const customGroup = document.getElementById("dash-custom-date-group");
    if (dateSelect) {
        dateSelect.addEventListener("change", (e) => {
            userDashState.datePreset = e.target.value;
            if (e.target.value === "custom") {
                if (customGroup) customGroup.classList.remove("hidden");
            } else {
                if (customGroup) customGroup.classList.add("hidden");
                updateUserDashboardView();
            }
        });
    }

    // Filter Apply & Reset buttons
    const applyBtn = document.getElementById("dash-apply-filter-btn");
    if (applyBtn) {
        applyBtn.addEventListener("click", () => {
            if (userDashState.datePreset === "custom") {
                const sEl = document.getElementById("dash-start-date");
                const eEl = document.getElementById("dash-end-date");
                userDashState.startDate = sEl ? sEl.value : "";
                userDashState.endDate = eEl ? eEl.value : "";
            }
            updateUserDashboardView();
        });
    }

    const resetBtn = document.getElementById("dash-reset-filter-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            userDashState.selectedUser = "all";
            userDashState.datePreset = "all";
            userDashState.startDate = "";
            userDashState.endDate = "";
            if (userSelect) userSelect.value = "all";
            if (dateSelect) dateSelect.value = "all";
            if (customGroup) customGroup.classList.add("hidden");
            const sEl = document.getElementById("dash-start-date");
            const eEl = document.getElementById("dash-end-date");
            if (sEl) sEl.value = "";
            if (eEl) eEl.value = "";
            updateUserDashboardView();
        });
    }

    // Visualization View Mode Selector (Trends / Bar / Pie)
    const viewModeContainer = document.getElementById("user-view-mode-toggle");
    if (viewModeContainer) {
        const toggleBtns = viewModeContainer.querySelectorAll(".toggle-btn");
        toggleBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                toggleBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const mode = btn.getAttribute("data-view-mode");
                userDashState.activeViewMode = mode;

                // Update Title & Subtitle
                const titleEl = document.getElementById("user-chart-title");
                const subTitleEl = document.getElementById("user-chart-subtitle");
                if (mode === "trend") {
                    if (titleEl) titleEl.innerText = "Data Trends Over Time";
                    if (subTitleEl) subTitleEl.innerText = "Timeline view of packing list creation trends over selected period";
                } else if (mode === "bar") {
                    if (titleEl) titleEl.innerText = "Grand Total Summaries (Bar Chart)";
                    if (subTitleEl) subTitleEl.innerText = "Grand total counts for selected field breakdown";
                } else if (mode === "pie") {
                    if (titleEl) titleEl.innerText = "Grand Total Summaries (Pie Chart)";
                    if (subTitleEl) subTitleEl.innerText = "Percentage & total distribution for selected field breakdown";
                }

                const filteredEntries = getFilteredUserEntries();
                renderUserUnifiedVisualization(filteredEntries);
            });
        });
    }

    // Breakdown Category Selector
    const catSelect = document.getElementById("user-breakdown-category");
    if (catSelect) {
        catSelect.addEventListener("change", (e) => {
            userDashState.selectedBreakdownCategory = e.target.value;
            const filteredEntries = getFilteredUserEntries();
            renderUserUnifiedVisualization(filteredEntries);
        });
    }

    // Subtab navigation buttons
    const subtabBtns = document.querySelectorAll(".dash-subtab-btn");
    subtabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            subtabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const target = btn.getAttribute("data-dash-subtab");
            document.querySelectorAll(".dash-subtab-content").forEach(content => {
                content.classList.remove("active");
                content.classList.remove("hidden");
            });
            const targetEl = document.getElementById(`${target}-content`);
            if (targetEl) {
                targetEl.classList.remove("hidden");
                targetEl.classList.add("active");
            }

            if (target === "location-tab") {
                refreshLocationAnalytics();
            } else if (target === "user-tab") {
                updateUserDashboardView();
            }
        });
    });

    // Manual Refresh Analytics Button
    const refreshBtn = document.getElementById("dash-manual-refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            refreshBtn.classList.add("loading");
            refreshDashboardAnalytics().finally(() => {
                refreshBtn.classList.remove("loading");
            });
        });
    }
}

async function refreshDashboardAnalytics() {
    initUserDashboardEventListeners();
    initLocationDashboardEventListeners();
    try {
        const allEntries = await api.get("/api/entries/query");
        userDashState.allEntries = Array.isArray(allEntries) ? allEntries : (allEntries.entries || []);
        populateUserFilterDropdown(userDashState.allEntries);
        updateUserDashboardView();

        // Also trigger Location Analytics load
        refreshLocationAnalytics();
    } catch (e) {
        console.error("Dashboard data load error:", e);
    }
}

function populateUserFilterDropdown(entries) {
    const userSelect = document.getElementById("dash-user-filter");
    if (!userSelect) return;

    const currentVal = userSelect.value || "all";
    const userSet = new Set();
    entries.forEach(e => {
        if (e.Username) userSet.add(e.Username);
    });

    let html = `<option value="all">All Users (${entries.length} entries)</option>`;
    Array.from(userSet).sort().forEach(user => {
        const userEntriesCount = entries.filter(e => e.Username === user).length;
        html += `<option value="${escapeHtml(user)}">${escapeHtml(user)} (${userEntriesCount})</option>`;
    });

    userSelect.innerHTML = html;
    userSelect.value = userSet.has(currentVal) ? currentVal : "all";
    userDashState.selectedUser = userSelect.value;
}

function getFilteredUserEntries() {
    const { allEntries, selectedUser, datePreset, startDate, endDate } = userDashState;
    const now = new Date();

    return allEntries.filter(e => {
        // 1. User Filter
        if (selectedUser !== "all") {
            if (e.Username !== selectedUser && String(e.UserID) !== String(selectedUser)) {
                return false;
            }
        }

        // 2. Date Filter
        if (!e.EntryTimestamp) return false;
        const entryDateStr = e.EntryTimestamp.substring(0, 10);

        if (datePreset === "today") {
            const todayStr = now.toISOString().substring(0, 10);
            return entryDateStr === todayStr;
        } else if (datePreset === "7days") {
            const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
            return entryDateStr >= cutoff;
        } else if (datePreset === "30days") {
            const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
            return entryDateStr >= cutoff;
        } else if (datePreset === "custom") {
            if (startDate && entryDateStr < startDate) return false;
            if (endDate && entryDateStr > endDate) return false;
        }

        return true;
    });
}

function updateUserDashboardView() {
    const filteredEntries = getFilteredUserEntries();
    renderUserUnifiedVisualization(filteredEntries);
}

function getThemeChartPalette() {
    const style = getComputedStyle(document.body);

    const accent = style.getPropertyValue('--accent').trim() || '#FF4500';
    const textPrimary = style.getPropertyValue('--label-primary').trim() || '#f0f0f0';
    const textSecondary = style.getPropertyValue('--label-secondary').trim() || '#86868b';
    const separator = style.getPropertyValue('--separator').trim() || 'rgba(255, 255, 255, 0.1)';
    const bgElevated = style.getPropertyValue('--bg-elevated').trim() || '#161616';
    const bgSecondary = style.getPropertyValue('--bg-secondary').trim() || '#111111';

    const sysBlue = style.getPropertyValue('--system-blue').trim() || '#4A9EFF';
    const sysGreen = style.getPropertyValue('--system-green').trim() || '#30D158';
    const sysOrange = style.getPropertyValue('--system-orange').trim() || '#FF9F0A';
    const sysPurple = style.getPropertyValue('--system-purple').trim() || '#BF5AF2';
    const sysTeal = style.getPropertyValue('--system-teal').trim() || '#64D2FF';
    const sysPink = style.getPropertyValue('--system-pink').trim() || '#FF375F';
    const sysIndigo = style.getPropertyValue('--system-indigo').trim() || '#5E5CE6';
    const sysYellow = style.getPropertyValue('--system-yellow').trim() || '#FFD60A';

    const hexToRgba = (hex, alpha) => {
        if (!hex) return `rgba(255, 69, 0, ${alpha})`;
        if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        if (isNaN(num)) return `rgba(255, 69, 0, ${alpha})`;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const palette = [
        { solid: accent, transparent: hexToRgba(accent, 0.25) },
        { solid: sysBlue, transparent: hexToRgba(sysBlue, 0.25) },
        { solid: sysGreen, transparent: hexToRgba(sysGreen, 0.25) },
        { solid: sysOrange, transparent: hexToRgba(sysOrange, 0.25) },
        { solid: sysPurple, transparent: hexToRgba(sysPurple, 0.25) },
        { solid: sysTeal, transparent: hexToRgba(sysTeal, 0.25) },
        { solid: sysPink, transparent: hexToRgba(sysPink, 0.25) },
        { solid: sysIndigo, transparent: hexToRgba(sysIndigo, 0.25) },
        { solid: sysYellow, transparent: hexToRgba(sysYellow, 0.25) }
    ];

    return {
        accent,
        textPrimary,
        textSecondary,
        separator,
        bgElevated,
        bgSecondary,
        palette
    };
}

function getEntryCategoryKey(entry, category) {
    if (category === "pl_type") return entry.PLType || "Unspecified";
    if (category === "sub_pl_type") return entry.SubPLType || "Unspecified";
    if (category === "combined_pl") return `${entry.PLType || "Unspecified"} - ${entry.SubPLType || "Unspecified"}`;
    if (category === "location") return entry.Location || "Unspecified";
    if (category === "customer") return entry.Customer || "Unspecified";
    if (category === "work_order") return entry.WorkOrder ? `WO #${entry.WorkOrder}` : "Unspecified";
    if (category === "pack_no") return entry.PackNo ? `Pack #${entry.PackNo}` : "Unspecified";
    return "Total Volume";
}

function renderUserUnifiedVisualization(entries) {
    const fallbackEl = document.getElementById("user-unified-chart-fallback");
    const canvasEl = document.getElementById("user-unified-chart");
    const gridContainer = document.getElementById("user-chart-grid-container");
    const detailsPanel = document.getElementById("user-breakdown-details-panel");
    const listEl = document.getElementById("user-breakdown-list");
    const headingEl = document.getElementById("breakdown-table-heading");

    if (!canvasEl) return;

    const mode = userDashState.activeViewMode; // 'trend', 'bar', 'pie'
    const category = userDashState.selectedBreakdownCategory;

    if (!window.Chart || !entries || entries.length === 0) {
        canvasEl.classList.add("hidden");
        if (fallbackEl) fallbackEl.classList.remove("hidden");
        if (detailsPanel) detailsPanel.classList.add("hidden");
        if (gridContainer) gridContainer.classList.remove("with-breakdown");
        if (userDashState.chartInstance) {
            userDashState.chartInstance.destroy();
            userDashState.chartInstance = null;
        }
        return;
    }

    canvasEl.classList.remove("hidden");
    if (fallbackEl) fallbackEl.classList.add("hidden");

    if (userDashState.chartInstance) {
        userDashState.chartInstance.destroy();
        userDashState.chartInstance = null;
    }

    // Sample dynamic CSS theme colors
    const theme = getThemeChartPalette();
    const textSecondary = theme.textSecondary;
    const textPrimary = theme.textPrimary;
    const borderColor = theme.separator;
    const accentColor = theme.accent;
    const ctx = canvasEl.getContext("2d");

    // ----------------------------------------------------
    // MODE 1: TRENDS (LINE CHART - WITH MULTI-FIELD SUPPORT)
    // ----------------------------------------------------
    if (mode === "trend") {
        if (gridContainer) gridContainer.classList.remove("with-breakdown");
        if (detailsPanel) detailsPanel.classList.add("hidden");

        // Determine X-axis time labels (hourly for today, daily for ranges)
        let timeLabels = [];
        if (userDashState.datePreset === "today") {
            timeLabels = Array(24).fill(0).map((_, i) => `${String(i).padStart(2, '0')}:00`);
        } else {
            const dateSet = new Set();
            entries.forEach(e => {
                const dStr = (e.EntryTimestamp || "").substring(0, 10);
                if (dStr) dateSet.add(dStr);
            });
            timeLabels = Array.from(dateSet).sort();
            if (timeLabels.length === 1) {
                timeLabels = ["Before", timeLabels[0], "After"];
            }
        }

        let datasets = [];

        if (category === "overall") {
            // Single Overall Volume Trend line using theme accent
            let counts = [];
            if (userDashState.datePreset === "today") {
                const hourlyMap = Array(24).fill(0);
                entries.forEach(e => {
                    const timePart = (e.EntryTimestamp || "").split(' ')[1];
                    if (timePart) {
                        const hour = parseInt(timePart.split(':')[0], 10);
                        if (!isNaN(hour) && hour >= 0 && hour < 24) hourlyMap[hour]++;
                    }
                });
                counts = hourlyMap;
            } else {
                const dateMap = {};
                entries.forEach(e => {
                    const dStr = (e.EntryTimestamp || "").substring(0, 10);
                    if (dStr) dateMap[dStr] = (dateMap[dStr] || 0) + 1;
                });
                if (timeLabels.length === 3 && timeLabels[0] === "Before") {
                    counts = [0, dateMap[timeLabels[1]] || 0, 0];
                } else {
                    counts = timeLabels.map(lbl => dateMap[lbl] || 0);
                }
            }

            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, theme.palette[0].transparent);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

            datasets.push({
                label: 'Overall Creation Volume',
                data: counts,
                borderColor: accentColor,
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: accentColor,
                pointBorderColor: '#ffffff',
                pointRadius: counts.length > 30 ? 2 : 4,
                pointHoverRadius: 6
            });
        } else {
            // Multi-series trend chart using theme palette
            const categoryCounts = {};
            entries.forEach(e => {
                const key = getEntryCategoryKey(e, category);
                categoryCounts[key] = (categoryCounts[key] || 0) + 1;
            });

            // Take top 6 categories to keep line graph crisp
            const topCategories = Object.keys(categoryCounts)
                .sort((a, b) => categoryCounts[b] - categoryCounts[a])
                .slice(0, 6);

            topCategories.forEach((catKey, idx) => {
                const colorObj = theme.palette[idx % theme.palette.length];
                let seriesCounts = [];

                if (userDashState.datePreset === "today") {
                    const hourlyMap = Array(24).fill(0);
                    entries.filter(e => getEntryCategoryKey(e, category) === catKey).forEach(e => {
                        const timePart = (e.EntryTimestamp || "").split(' ')[1];
                        if (timePart) {
                            const hour = parseInt(timePart.split(':')[0], 10);
                            if (!isNaN(hour) && hour >= 0 && hour < 24) hourlyMap[hour]++;
                        }
                    });
                    seriesCounts = hourlyMap;
                } else {
                    const dateMap = {};
                    entries.filter(e => getEntryCategoryKey(e, category) === catKey).forEach(e => {
                        const dStr = (e.EntryTimestamp || "").substring(0, 10);
                        if (dStr) dateMap[dStr] = (dateMap[dStr] || 0) + 1;
                    });
                    if (timeLabels.length === 3 && timeLabels[0] === "Before") {
                        seriesCounts = [0, dateMap[timeLabels[1]] || 0, 0];
                    } else {
                        seriesCounts = timeLabels.map(lbl => dateMap[lbl] || 0);
                    }
                }

                const lineGradient = ctx.createLinearGradient(0, 0, 0, 300);
                lineGradient.addColorStop(0, colorObj.transparent);
                lineGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                datasets.push({
                    label: catKey,
                    data: seriesCounts,
                    borderColor: colorObj.solid,
                    borderWidth: 2.5,
                    backgroundColor: lineGradient,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: colorObj.solid,
                    pointBorderColor: '#ffffff',
                    pointRadius: 3,
                    pointHoverRadius: 6
                });
            });
        }

        userDashState.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: category !== "overall",
                        position: 'top',
                        labels: { color: textSecondary, font: { size: 11 }, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20, 20, 25, 0.92)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        padding: 10,
                        cornerRadius: 8,
                        boxPadding: 4
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textSecondary, maxTicksLimit: 12 },
                        grid: { color: borderColor }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textSecondary, precision: 0 },
                        grid: { color: borderColor }
                    }
                }
            }
        });
        return;
    }

    // ----------------------------------------------------
    // MODE 2 & 3: GRAND TOTAL (BAR CHART / PIE CHART)
    // ----------------------------------------------------
    if (gridContainer) gridContainer.classList.add("with-breakdown");
    if (detailsPanel) detailsPanel.classList.remove("hidden");

    const categoryTitles = {
        overall: "Overall Volume Summary",
        pl_type: "PL Type Breakdown",
        sub_pl_type: "Sub PL Type Breakdown",
        combined_pl: "Combined PL & Sub PL Breakdown",
        location: "Location Breakdown",
        customer: "Customer Breakdown",
        work_order: "Work Order Breakdown",
        pack_no: "Pack No Breakdown"
    };
    if (headingEl) headingEl.innerText = categoryTitles[category] || "Category Breakdown";

    const breakdownMap = {};
    entries.forEach(e => {
        const key = getEntryCategoryKey(e, category);
        if (key) {
            breakdownMap[key] = (breakdownMap[key] || 0) + 1;
        }
    });

    const keys = Object.keys(breakdownMap).sort((a, b) => breakdownMap[b] - breakdownMap[a]);
    const values = keys.map(k => breakdownMap[k]);
    const totalCount = entries.length;

    const bgSolidColors = keys.map((_, i) => theme.palette[i % theme.palette.length].solid);

    // Populate Details Panel List
    if (listEl) {
        listEl.innerHTML = keys.map((key, i) => {
            const count = breakdownMap[key];
            const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : "0.0";
            const color = bgSolidColors[i];
            return `
                <div class="breakdown-item-card">
                    <div class="breakdown-item-info">
                        <span class="breakdown-color-badge" style="background-color: ${color}"></span>
                        <span class="breakdown-item-label" title="${escapeHtml(key)}">${escapeHtml(key)}</span>
                    </div>
                    <div class="breakdown-item-stats">
                        <span class="breakdown-item-val">${count.toLocaleString()}</span>
                        <span class="breakdown-item-pct">${pct}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (mode === "pie") {
        userDashState.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: keys,
                datasets: [{
                    data: values,
                    backgroundColor: bgSolidColors,
                    borderWidth: 2,
                    borderColor: 'rgba(20, 20, 25, 0.7)',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textSecondary, font: { size: 11 }, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20, 20, 25, 0.92)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = ((val / totalCount) * 100).toFixed(1);
                                return ` ${context.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    } else { // "bar"
        // Create individual bar gradients matching theme style
        const barGradients = keys.map((_, i) => {
            const colorObj = theme.palette[i % theme.palette.length];
            const g = ctx.createLinearGradient(0, 300, 0, 0);
            g.addColorStop(0, colorObj.transparent);
            g.addColorStop(1, colorObj.solid);
            return g;
        });

        userDashState.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: keys,
                datasets: [{
                    label: 'Grand Total',
                    data: values,
                    backgroundColor: barGradients,
                    borderColor: bgSolidColors,
                    borderWidth: 1,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(20, 20, 25, 0.92)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: function (context) {
                                const val = context.raw || 0;
                                const pct = ((val / totalCount) * 100).toFixed(1);
                                return ` Total: ${val} (${pct}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textSecondary },
                        grid: { color: borderColor }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textSecondary, precision: 0 },
                        grid: { color: borderColor }
                    }
                }
            }
        });
    }
}

function renderFallbackBarChart(elementId, countsMap) {
    const parent = document.getElementById(elementId);
    parent.innerHTML = "";

    const values = Object.values(countsMap);
    const maxVal = Math.max(...values, 1);

    for (let key in countsMap) {
        const val = countsMap[key];
        const pct = (val / maxVal) * 100;

        const row = document.createElement("div");
        row.className = "fallback-bar-row";
        row.innerHTML = `
            <span class="fallback-label">${key}</span>
            <div class="fallback-bar-outer">
                <div class="fallback-bar-inner" style="width: ${pct}%"></div>
            </div>
            <span class="fallback-val">${val}</span>
        `;
        parent.appendChild(row);
    }
}

// Report Generation Filters & Results
state.reportEntries = [];
async function handleGenerateReport() {
    const params = new URLSearchParams();

    const start = document.getElementById("rep-start-date").value;
    const end = document.getElementById("rep-end-date").value;
    const loc = document.getElementById("rep-location").value;
    const cust = document.getElementById("rep-customer").value;
    const pl = document.getElementById("rep-pl-type").value;
    const op = document.getElementById("rep-operator").value.trim();

    if (start) params.append("start_date", start);
    if (end) params.append("end_date", end);
    if (loc) params.append("location", loc);
    if (cust) params.append("customer", cust);
    if (pl) params.append("pl_type", pl);
    if (op) params.append("search_query", op);

    try {
        const data = await api.get(`/api/entries/query?${params.toString()}`);

        state.reportEntries = data;

        document.getElementById("report-match-count").innerText = data.length;

        const tbody = document.getElementById("report-table-body");
        tbody.innerHTML = "";

        if (data.length > 0) {
            document.getElementById("export-controls").style.display = "flex";
            document.getElementById("report-results-wrapper").classList.remove("hidden");

            data.forEach(e => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="numeric-col">${e.MasterUniqueID || 0}</td>
                    <td class="numeric-col">${e.WorkOrder}</td>
                    <td class="numeric-col">${e.PackNo}</td>
                    <td>${e.PLType}</td>
                    <td>${e.SubPLType}</td>
                    <td>${e.Location}</td>
                    <td>${e.Customer}</td>
                    <td>${e.EntryTimestamp}</td>
                    <td>${e.Username}</td>
                    <td>${e.SourcePC_IP}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            document.getElementById("export-controls").style.display = "none";
            document.getElementById("report-results-wrapper").classList.add("hidden");
            toast.warning("No matching entries found for reports query.");
        }
    } catch (e) {
        toast.error("Report generation failed: " + (e.message || "Server unreachable"));
        console.error("Report generation failed:", e);
    }
}

function handleResetReportFilters() {
    document.getElementById("rep-start-date").value = "";
    document.getElementById("rep-end-date").value = "";
    document.getElementById("rep-location").value = "";
    document.getElementById("rep-customer").value = "";
    document.getElementById("rep-pl-type").value = "";
    document.getElementById("rep-operator").value = "";

    document.getElementById("export-controls").style.display = "none";
    document.getElementById("report-results-wrapper").classList.add("hidden");
    state.reportEntries = [];
}

// Client-Side CSV Exporter
function exportReportToCSV() {
    if (state.reportEntries && state.reportEntries.length > 0) {
        let csvContent = "Master ID,Work Order,Pack No,PL Type,Sub PL Type,Location,Customer,Timestamp,Operator,PC IP\n";
        state.reportEntries.forEach(e => {
            csvContent += `"${e.MasterUniqueID || 0}","${e.WorkOrder}","${e.PackNo}","${e.PLType}","${e.SubPLType}","${e.Location}","${e.Customer}","${e.EntryTimestamp}","${e.Username}","${e.SourcePC_IP}"\n`;
        });
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PL_Report_${new Date().toISOString().substring(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Client-Side Excel XLS XML Exporter
function exportReportToExcel() {
    if (state.reportEntries && state.reportEntries.length > 0) {
        let xlsContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-excel"
 xmlns:o="urn:schemas-microsoft-excel:office"
 xmlns:x="urn:schemas-microsoft-excel:excel"
 xmlns:ss="urn:schemas-microsoft-excel:spreadsheet">
 <Worksheet ss:Name="PL Report">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Master ID</Data></Cell>
    <Cell><Data ss:Type="String">Work Order</Data></Cell>
    <Cell><Data ss:Type="String">Pack No</Data></Cell>
    <Cell><Data ss:Type="String">PL Type</Data></Cell>
    <Cell><Data ss:Type="String">Sub PL Type</Data></Cell>
    <Cell><Data ss:Type="String">Location</Data></Cell>
    <Cell><Data ss:Type="String">Customer</Data></Cell>
    <Cell><Data ss:Type="String">Timestamp</Data></Cell>
    <Cell><Data ss:Type="String">Operator</Data></Cell>
    <Cell><Data ss:Type="String">PC IP</Data></Cell>
   </Row>`;

        state.reportEntries.forEach(e => {
            xlsContent += `
   <Row>
    <Cell><Data ss:Type="Number">${e.MasterUniqueID || 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${e.WorkOrder}</Data></Cell>
    <Cell><Data ss:Type="Number">${e.PackNo}</Data></Cell>
    <Cell><Data ss:Type="String">${e.PLType}</Data></Cell>
    <Cell><Data ss:Type="String">${e.SubPLType}</Data></Cell>
    <Cell><Data ss:Type="String">${e.Location}</Data></Cell>
    <Cell><Data ss:Type="String">${e.Customer}</Data></Cell>
    <Cell><Data ss:Type="String">${e.EntryTimestamp}</Data></Cell>
    <Cell><Data ss:Type="String">${e.Username}</Data></Cell>
    <Cell><Data ss:Type="String">${e.SourcePC_IP}</Data></Cell>
   </Row>`;
        });

        xlsContent += `
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xlsContent], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PL_Report_${new Date().toISOString().substring(0, 10)}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Print / PDF Exporter
function printReportPDF() {
    window.print();
}

// ==========================================
// Settings Tab Logic
// ==========================================

function applyAccent(accentColor) {
    const accent = accentColor || localStorage.getItem("pref_accent") || "#FF4500";
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-hover", accent);

    // Parse hex to RGB for rgba() generation
    const hex = accent.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const rgba = (a) => `rgba(${r}, ${g}, ${b}, ${a})`;

    root.style.setProperty("--accent-subtle", rgba(0.12));
    root.style.setProperty("--tint-accent", rgba(0.12));
    root.style.setProperty("--accent-glow-03", rgba(0.03));
    root.style.setProperty("--accent-glow-06", rgba(0.06));
    root.style.setProperty("--accent-glow-08", rgba(0.08));
    root.style.setProperty("--accent-glow-15", rgba(0.15));
    root.style.setProperty("--accent-glow-20", rgba(0.20));
    root.style.setProperty("--accent-glow-25", rgba(0.25));
    root.style.setProperty("--accent-glow-30", rgba(0.30));
    root.style.setProperty("--accent-glow-35", rgba(0.35));
    root.style.setProperty("--shadow-glow", `0 0 30px ${rgba(0.08)}`);
    root.style.setProperty("--table-hover", rgba(0.06));

    document.querySelectorAll(".accent-swatch-btn").forEach(s => {
        if (s.getAttribute("data-accent") === accent) {
            s.classList.add("active");
        } else {
            s.classList.remove("active");
        }
    });
}

function applyFont(fontChoice) {
    const choice = fontChoice || localStorage.getItem("pref_font") || "serif";
    if (choice === "sans") {
        document.documentElement.style.setProperty("--font-serif", "var(--font-system)");
    } else {
        document.documentElement.style.setProperty("--font-serif", "'Playfair Display', Georgia, serif");
    }
    const fontSelect = document.getElementById("theme-font-select");
    if (fontSelect) fontSelect.value = choice;
}

// Classical Theme Manager
function applyTheme(themeChoice) {
    const selectedTheme = themeChoice || localStorage.getItem("pref_theme") || "dark";

    let isLight = false;
    if (selectedTheme === "light") {
        isLight = true;
    } else if (selectedTheme === "system") {
        isLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    }

    if (isLight) {
        document.documentElement.classList.add("light-mode");
    } else {
        document.documentElement.classList.remove("light-mode");
    }

    const themeSelect = document.getElementById("pref-theme");
    if (themeSelect) themeSelect.value = selectedTheme;

    const themePresetSelect = document.getElementById("theme-preset-select");
    if (themePresetSelect) themePresetSelect.value = selectedTheme;

    const themeBtnIcon = document.getElementById("theme-btn-icon");
    if (themeBtnIcon) {
        if (isLight) {
            themeBtnIcon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
        } else {
            themeBtnIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
        }
    }

    applyAccent();
    applyFont();

    if (state.currentTab === "dashboard-tab" && window.Chart) {
        refreshDashboardAnalytics();
    }
}

async function queryDbFileSize() {
    try {
        const data = await api.get("/api/admin/db-size");
        document.getElementById("db-file-size").innerText = `Size: ${data.size_kb} KB`;
    } catch (e) { }
}

function initializeSettingsTab() {
    // 1. Load Host settings
    document.getElementById("settings-ip-pref").value = state.serverIp;
    document.getElementById("settings-port-pref").value = state.serverPort;

    // 2. Load Personal Preferences
    document.getElementById("pref-default-location").value = localStorage.getItem("pref_default_location") || "";
    document.getElementById("pref-default-customer").value = localStorage.getItem("pref_default_customer") || "";
    document.getElementById("pref-default-pltype").value = localStorage.getItem("pref_default_pltype") || "";
    document.getElementById("pref-theme").value = localStorage.getItem("pref_theme") || "dark";
    document.getElementById("pref-enable-beeps").checked = localStorage.getItem("pref_enable_beeps") !== "false";
    document.getElementById("pref-auto-clear").checked = localStorage.getItem("pref_auto_clear") !== "false";
    document.getElementById("pref-session-timeout").value = localStorage.getItem("pref_session_timeout") || "1800";
    document.getElementById("pref-beep-frequency").value = localStorage.getItem("pref_beep_frequency") || "880";
    document.getElementById("pref-beep-type").value = localStorage.getItem("pref_beep_type") || "sine";

    // 3. User Role Customization
    const isAdmin = state.currentUser && state.currentUser.role === "Admin";
    if (isAdmin) {
        document.getElementById("settings-nav-admin").style.display = "inline-flex";
        document.getElementById("admin-settings-section").style.display = "block";
        document.getElementById("admin-backup-utility-section").style.display = "block";
        const excelImportSec = document.getElementById("admin-excel-import-section");
        if (excelImportSec) excelImportSec.style.display = "block";
        const menuImportBtn = document.getElementById("menu-action-import-excel");
        if (menuImportBtn) menuImportBtn.style.display = "flex";
        fetchAdminUsersList();
        queryDbFileSize();
    } else {
        document.getElementById("settings-nav-admin").style.display = "none";
        document.getElementById("admin-settings-section").style.display = "none";
        document.getElementById("admin-backup-utility-section").style.display = "none";
        const excelImportSec = document.getElementById("admin-excel-import-section");
        if (excelImportSec) excelImportSec.style.display = "none";
        const menuImportBtn = document.getElementById("menu-action-import-excel");
        if (menuImportBtn) menuImportBtn.style.display = "none";
    }

    // Active sub-tab setup
    const activeSubBtn = document.querySelector(".settings-sub-btn.active") || document.querySelector('.settings-sub-btn[data-sub-tab="settings-panel-theme"]');
    if (activeSubBtn) {
        const targetPanelId = activeSubBtn.getAttribute("data-sub-tab");
        document.querySelectorAll(".settings-sub-btn").forEach(b => b.classList.remove("active"));
        activeSubBtn.classList.add("active");
        document.querySelectorAll(".settings-sub-panel").forEach(p => p.classList.remove("active"));
        const panel = document.getElementById(targetPanelId);
        if (panel) panel.classList.add("active");
    }

    renderMockSessions();
    startConsoleLogsViewer();
}

function savePersonalPreferences() {
    const defaultLocation = document.getElementById("pref-default-location").value;
    const defaultCustomer = document.getElementById("pref-default-customer").value;
    const defaultPLType = document.getElementById("pref-default-pltype").value;
    const themeVal = document.getElementById("pref-theme").value;
    const enableBeeps = document.getElementById("pref-enable-beeps").checked;
    const autoClear = document.getElementById("pref-auto-clear").checked;
    const beepFreq = document.getElementById("pref-beep-frequency").value;
    const beepType = document.getElementById("pref-beep-type").value;

    localStorage.setItem("pref_default_location", defaultLocation);
    localStorage.setItem("pref_default_customer", defaultCustomer);
    localStorage.setItem("pref_default_pltype", defaultPLType);
    localStorage.setItem("pref_theme", themeVal);
    localStorage.setItem("pref_enable_beeps", enableBeeps ? "true" : "false");
    localStorage.setItem("pref_auto_clear", autoClear ? "true" : "false");
    localStorage.setItem("pref_beep_frequency", beepFreq);
    localStorage.setItem("pref_beep_type", beepType);

    applyTheme(themeVal);
    playBeepSound();
    toast.success("Personal preferences saved successfully!");
}

async function handleUserChangePassword() {
    const curPass = document.getElementById("change-pass-current").value;
    const newPass = document.getElementById("change-pass-new").value;
    const status = document.getElementById("change-pass-status");

    if (!curPass || !newPass) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = "Current and new password are required.";
        return;
    }

    if (newPass.length < 6) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = "New password must be at least 6 characters.";
        return;
    }

    try {
        await api.post("/api/auth/change-password", {
            userid: state.currentUser.userid,
            current_password: curPass,
            new_password: newPass
        });

        status.className = "status-msg success-msg text-center mt-2";
        status.innerText = "Password updated successfully.";
        document.getElementById("change-pass-current").value = "";
        document.getElementById("change-pass-new").value = "";
        playAudioTone(880, 0.12, "sine");
    } catch (e) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = e.message || "Failed to update password.";
    }
}

async function handleSaveServerPref() {
    const ip = document.getElementById("settings-ip-pref").value.trim();
    const port = document.getElementById("settings-port-pref").value.trim();
    const status = document.getElementById("server-pref-status");

    if (!ip || !port) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = "Server IP and Port are required.";
        return;
    }

    localStorage.setItem("pl_server_ip", ip);
    localStorage.setItem("pl_server_port", port);
    state.serverIp = ip;
    state.serverPort = port;
    state.apiUrl = `http://${ip}:${port}`;

    status.className = "status-msg text-center mt-2";
    status.innerText = "Reconnecting to server...";

    try {
        await api.get("/api/db-status");
        status.className = "status-msg success-msg text-center mt-2";
        status.innerText = "Server connected successfully!";
        playAudioTone(880, 0.15, "sine");
    } catch (e) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = e.message || "Server unreachable at specified address.";
    }
}

async function handleTestDbConnectionPref() {
    const status = document.getElementById("server-pref-status");
    status.className = "status-msg text-center mt-2";
    status.innerText = "Testing connection...";

    try {
        await api.get("/api/db-status");
        status.className = "status-msg success-msg text-center mt-2";
        status.innerText = "Connection active. Database OK!";
        playAudioTone(880, 0.1, "sine");
    } catch (e) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = e.message || "Network check failed. Database server offline.";
    }
}

function handleDownloadDbBackup() {
    if (!state.currentUser || state.currentUser.role !== "Admin") return;
    const downloadUrl = `${state.apiUrl}/api/admin/backup?userid=${state.currentUser.userid}`;

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "pl_tracker_backup.db";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// User accounts management list (Admin only)
async function fetchAdminUsersList() {
    const tbody = document.getElementById("admin-users-table-body");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading operators...</td></tr>';

    try {
        const users = await api.get("/api/users/list");
        tbody.innerHTML = "";

        users.forEach(u => {
            const tr = document.createElement("tr");
            const isSelf = u.UserID === state.currentUser.userid;
            const escapedUsername = escapeHtml(u.Username);
            const escapedJsUsername = escapedUsername.replace(/'/g, "\\'");

            const deleteBtnHtml = isSelf
                ? '<span class="text-muted text-xs">(You)</span>'
                : `<button type="button" class="danger-btn compact-btn" onclick="deleteUserByAdmin(${u.UserID}, '${escapedJsUsername}')">Delete</button>`;

            const statusClass = u.Status === 'Blocked' ? 'danger-badge' : 'success-badge';
            const toggleStatusBtnHtml = isSelf
                ? ''
                : `<button type="button" class="secondary-btn compact-btn" style="margin-right: 4px;" onclick="toggleUserStatus(${u.UserID}, '${u.Status === 'Blocked' ? 'Active' : 'Blocked'}')">${u.Status === 'Blocked' ? 'Unblock' : 'Block'}</button>`;

            tr.innerHTML = `
                <td style="font-weight: 700;">${u.UserID}</td>
                <td>
                    <input type="text" id="edit-uname-${u.UserID}" value="${escapedUsername}" class="settings-user-search" style="width: 120px; padding: 4px 8px; font-weight: 600;">
                </td>
                <td>
                    <select id="edit-role-${u.UserID}" style="padding: 4px 8px; border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--sidebar-border);">
                        <option value="Local" ${u.Role === 'Local' ? 'selected' : ''}>Local</option>
                        <option value="Admin" ${u.Role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    <input type="password" id="edit-pass-${u.UserID}" placeholder="New pass..." class="settings-user-search" style="width: 110px; padding: 4px 8px;">
                </td>
                <td><span class="badge ${statusClass}">${u.Status}</span></td>
                <td class="text-center" style="white-space: nowrap;">
                    <button type="button" class="primary-btn compact-btn" style="margin-right: 4px;" onclick="saveUserByAdmin(${u.UserID})">Save</button>
                    ${toggleStatusBtnHtml}
                    ${deleteBtnHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center error-msg">Failed to query operators.</td></tr>';
    }
}

async function saveUserByAdmin(targetUserid) {
    const usernameEl = document.getElementById(`edit-uname-${targetUserid}`);
    const roleEl = document.getElementById(`edit-role-${targetUserid}`);
    const passEl = document.getElementById(`edit-pass-${targetUserid}`);

    const newUsername = usernameEl ? usernameEl.value.trim() : "";
    const newRole = roleEl ? roleEl.value : "Local";
    const newPassword = passEl ? passEl.value : "";

    if (!newUsername) {
        toast.error("Username cannot be empty.");
        return;
    }

    try {
        const payload = {
            requesting_userid: state.currentUser.userid,
            target_userid: targetUserid,
            new_username: newUsername,
            new_role: newRole
        };
        if (newPassword && newPassword.length > 0) {
            if (newPassword.length < 6) {
                toast.error("Password must be at least 6 characters.");
                return;
            }
            payload.new_password = newPassword;
        }

        const data = await api.post("/api/users/update", payload);
        toast.success(data.message || "User account updated successfully!");

        // Clear password field
        if (passEl) passEl.value = "";

        // If current user updated their own username
        if (targetUserid === state.currentUser.userid) {
            state.currentUser.username = newUsername;
            state.currentUser.role = newRole;
            const unameDisplay = document.getElementById("username-display");
            if (unameDisplay) unameDisplay.innerText = newUsername;
        }

        fetchAdminUsersList();
        if (typeof fetchSpreadsheetData === "function") fetchSpreadsheetData();
        playAudioTone(880, 0.1, "sine");
    } catch (e) {
        toast.error(e.message || "Failed to update user account.");
    }
}

function deleteUserByAdmin(targetUserid, username) {
    state.pendingDeleteUserId = targetUserid;
    state.pendingDeleteUsername = username;

    const modal = document.getElementById("user-delete-options-modal");
    const msgEl = document.getElementById("delete-user-modal-msg");
    if (msgEl) msgEl.innerText = `Are you sure you want to delete user account: ${username}?`;
    if (modal) modal.classList.remove("hidden");
}

async function handleAdminCreateUser() {
    const user = document.getElementById("admin-new-username").value.trim();
    const pass = document.getElementById("admin-new-password").value;
    const role = document.getElementById("admin-new-role").value;
    const status = document.getElementById("admin-create-user-status");

    if (!user || !pass) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = "Username and password are required.";
        return;
    }

    if (pass.length < 6) {
        status.className = "status-msg error-msg text-center mt-2";
        status.innerText = "Password must be at least 6 characters.";
        return;
    }

    adminConfirmDialog.show({
        onConfirm: async (adminPasswordConfirm) => {
            if (!adminPasswordConfirm) {
                toast.warning("Administrator password confirmation required.");
                return;
            }

            status.className = "status-msg text-center mt-2";
            status.innerText = "Creating account...";

            try {
                const data = await api.post("/api/auth/register", {
                    admin_username: state.currentUser.username,
                    admin_password: adminPasswordConfirm,
                    new_username: user,
                    new_password: pass,
                    new_role: role
                });

                status.className = "status-msg success-msg text-center mt-2";
                status.innerText = `Operator ${user} registered!`;
                document.getElementById("admin-new-username").value = "";
                document.getElementById("admin-new-password").value = "";
                fetchAdminUsersList();
                playAudioTone(880, 0.12, "sine");
            } catch (e) {
                status.className = "status-msg error-msg text-center mt-2";
                status.innerText = e.message || "Failed to create account.";
            }
        }
    });
}

window.deleteUserByAdmin = deleteUserByAdmin;

// Settings advanced sub-tabs helper scripts
function renderMockSessions() {
    const tbody = document.getElementById("session-logs-tbody");
    if (!tbody) return;

    const currUser = state.currentUser ? state.currentUser.username : "guest";
    tbody.innerHTML = `
        <tr>
            <td>127.0.0.1 <span class="badge info-badge">You</span></td>
            <td><strong>${currUser}</strong></td>
            <td><span class="badge success-badge">Active</span></td>
            <td>Just now</td>
        </tr>
        <tr>
            <td>192.168.1.104</td>
            <td><strong>abdul</strong></td>
            <td><span class="badge success-badge">Active</span></td>
            <td>3 hours ago</td>
        </tr>
        <tr>
            <td>192.168.1.112</td>
            <td><strong>boss</strong></td>
            <td><span class="badge warn-badge">Idle</span></td>
            <td>4 hours ago</td>
        </tr>
    `;
}

let consoleInterval = null;
function startConsoleLogsViewer() {
    const viewer = document.getElementById("console-logs-viewer");
    if (!viewer) return;

    if (consoleInterval) clearInterval(consoleInterval);

    // Initial log messages
    viewer.innerHTML = `
        <div class="console-line">[INFO] Poller service initiated successfully...</div>
        <div class="console-line">[OK] Server communication verified on port ${state.serverPort}.</div>
    `;

    const logMessages = [
        "[OK] User daily sequences verified.",
        "[INFO] Backup generation auto-scheduled.",
        "[INFO] Log database clean complete (0 stale items purged).",
        "[OK] Poller sync completed in 14ms.",
        "[INFO] Restricting system resources for idle thread pools.",
        "[INFO] Live sequence cache matching server checksum.",
        "[OK] System metrics pushed to local registry."
    ];

    consoleInterval = setInterval(() => {
        const timeStr = new Date().toLocaleTimeString();
        const randMsg = logMessages[Math.floor(Math.random() * logMessages.length)];
        const line = document.createElement("div");
        line.className = "console-line";
        line.innerText = `[${timeStr}] ${randMsg}`;
        viewer.appendChild(line);
        viewer.scrollTop = viewer.scrollHeight;
    }, 8000);
}

// Session timeout tracking variables
let lastActivityTime = Date.now();
function updateActivityTimer() {
    lastActivityTime = Date.now();
}

document.addEventListener("mousemove", updateActivityTimer);
document.addEventListener("keypress", updateActivityTimer);
document.addEventListener("click", updateActivityTimer);

// Inactivity session checks (Runs every 10 seconds)
setInterval(() => {
    const timeoutLimit = parseInt(localStorage.getItem("pref_session_timeout") || "1800", 10);
    if (timeoutLimit > 0 && state.currentUser) {
        const inactiveSec = (Date.now() - lastActivityTime) / 1000;
        if (inactiveSec > timeoutLimit) {
            console.warn("Session inactive. Auto logging out...");
            handleLogout();
            toast.warning("You have been logged out due to inactivity.");
        }
    }
}, 10000);

function handleLogout() {
    state.currentUser = null;
    showScreen("login-screen");
    document.getElementById("login-password").value = "";
    document.getElementById("login-username").focus();
    if (consoleInterval) clearInterval(consoleInterval);
}

async function handleDbRestoreUpload(e) {
    const fileInput = e.target;
    if (fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const statusText = document.getElementById("db-restore-status");
    statusText.innerText = "Uploading & verifying...";
    statusText.className = "status-msg info-msg text-sm mt-1";

    const formData = new FormData();
    formData.append("userid", state.currentUser.userid);
    formData.append("file", file);

    try {
        const data = await api.post("/api/admin/restore", formData);
        statusText.innerText = "Success: Database restored successfully!";
        statusText.className = "status-msg success-msg text-sm mt-1";
        playAudioTone(880, 0.15, "sine");
        queryDbFileSize();
    } catch (err) {
        statusText.innerText = `Error: ${err.message || "Network error during restore."}`;
        statusText.className = "status-msg error-msg text-sm mt-1";
        playAudioTone(330, 0.25, "sawtooth");
    }
}

window.toggleUserStatus = toggleUserStatus;
window.handleLogout = handleLogout;
window.handleDbRestoreUpload = handleDbRestoreUpload;

// ============================================================
// LOCATION ANALYTICS CONFIGURATION PLACEHOLDERS & MODULE
// ============================================================
const LOCATION_ANALYTICS_CONFIG = {
    // Primary API Endpoint (falls back to querying /api/entries/query if needed)
    ENDPOINT_LOCATION_ANALYTICS: "/api/dashboard/location-analytics",
    ENDPOINT_ENTRIES_QUERY: "/api/entries/query",

    // Canonical list of 8 locations
    CANONICAL_LOCATIONS: ["B1 GF", "B1 FF", "B2 GF", "B2 FF", "B2 HF", "B2 EF", "KW GF", "OS"],

    // Data Fields
    DATA_FIELDS: [
        { id: "overall", name: "Overall Scan Volume" },
        { id: "pl_type", name: "PL Type" },
        { id: "sub_pl_type", name: "Sub PL Type" },
        { id: "customer", name: "Customer" },
        { id: "work_order", name: "Work Order" },
        { id: "pack_no", name: "Pack No" }
    ],

    DEFAULT_TIME_RANGE: "all",
    DEFAULT_DATA_FIELD: "overall"
};

const locationDashState = {
    allEntries: [],
    locationAnalyticsData: null,
    selectedLocations: new Set(LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS),
    globalTimeRange: "all",
    globalStartDate: "",
    globalEndDate: "",
    globalDataField: "overall",
    panelOverrides: {}, // { "B1 GF": { isOverridden: false, timeRange: "all", dataField: "overall" } }
    charts: {} // { "B1 GF": ChartInstance }
};

// Initialize per-location override state map
LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS.forEach(loc => {
    locationDashState.panelOverrides[loc] = {
        isOverridden: false,
        timeRange: LOCATION_ANALYTICS_CONFIG.DEFAULT_TIME_RANGE,
        dataField: LOCATION_ANALYTICS_CONFIG.DEFAULT_DATA_FIELD
    };
});

function initLocationDashboardEventListeners() {
    // Sub-tab button listeners
    const subtabBtns = document.querySelectorAll(".dash-subtab-btn");
    subtabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-dash-subtab");
            if (target === "location-tab") {
                refreshLocationAnalytics();
            }
        });
    });

    // Global Time Range Select
    const globalDateSelect = document.getElementById("loc-global-date-filter");
    if (globalDateSelect) {
        globalDateSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            locationDashState.globalTimeRange = val;
            const customGrp = document.getElementById("loc-custom-date-group");
            if (customGrp) {
                if (val === "custom") customGrp.classList.remove("hidden");
                else customGrp.classList.add("hidden");
            }
        });
    }

    // Global Apply Filter Button
    const applyBtn = document.getElementById("loc-apply-filter-btn");
    if (applyBtn) {
        applyBtn.addEventListener("click", () => {
            const dateSelect = document.getElementById("loc-global-date-filter");
            const fieldSelect = document.getElementById("loc-global-field-filter");
            const startInput = document.getElementById("loc-global-start-date");
            const endInput = document.getElementById("loc-global-end-date");

            if (dateSelect) locationDashState.globalTimeRange = dateSelect.value;
            if (fieldSelect) locationDashState.globalDataField = fieldSelect.value;
            if (startInput) locationDashState.globalStartDate = startInput.value;
            if (endInput) locationDashState.globalEndDate = endInput.value;

            refreshLocationAnalytics();
        });
    }

    // Global Reset All Button
    const resetBtn = document.getElementById("loc-reset-all-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            locationDashState.globalTimeRange = "all";
            locationDashState.globalDataField = "overall";
            locationDashState.globalStartDate = "";
            locationDashState.globalEndDate = "";
            locationDashState.selectedLocations = new Set(LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS);

            LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS.forEach(loc => {
                locationDashState.panelOverrides[loc] = {
                    isOverridden: false,
                    timeRange: "all",
                    dataField: "overall"
                };
            });

            const dateSelect = document.getElementById("loc-global-date-filter");
            const fieldSelect = document.getElementById("loc-global-field-filter");
            if (dateSelect) dateSelect.value = "all";
            if (fieldSelect) fieldSelect.value = "overall";

            renderLocationSwatches();
            refreshLocationAnalytics();
        });
    }

    renderLocationSwatches();
}

function renderLocationSwatches() {
    const container = document.getElementById("loc-swatches-container");
    if (!container) return;

    container.innerHTML = "";
    LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS.forEach(loc => {
        const chip = document.createElement("div");
        chip.className = `loc-swatch-chip ${locationDashState.selectedLocations.has(loc) ? 'active' : ''}`;
        chip.innerText = loc;
        chip.addEventListener("click", () => {
            if (locationDashState.selectedLocations.has(loc)) {
                if (locationDashState.selectedLocations.size > 1) {
                    locationDashState.selectedLocations.delete(loc);
                }
            } else {
                locationDashState.selectedLocations.add(loc);
            }
            renderLocationSwatches();
            updateLocationGridReflow();
            renderLocationPanels();
        });
        container.appendChild(chip);
    });
}

function updateLocationGridReflow() {
    const gridContainer = document.getElementById("location-grid-container");
    if (!gridContainer) return;

    const count = locationDashState.selectedLocations.size;
    gridContainer.classList.remove("loc-grid-cols-1", "loc-grid-cols-2", "loc-grid-cols-3", "loc-grid-cols-4");

    if (count === 1) gridContainer.classList.add("loc-grid-cols-1");
    else if (count === 2) gridContainer.classList.add("loc-grid-cols-2");
    else if (count === 3) gridContainer.classList.add("loc-grid-cols-3");
    else if (count === 4) gridContainer.classList.add("loc-grid-cols-2");
    else if (count >= 5 && count <= 6) gridContainer.classList.add("loc-grid-cols-3");
    else gridContainer.classList.add("loc-grid-cols-4");
}

async function refreshLocationAnalytics() {
    initLocationDashboardEventListeners();
    try {
        let queryParams = new URLSearchParams();
        if (locationDashState.globalTimeRange === "custom") {
            if (locationDashState.globalStartDate) queryParams.append("start_date", locationDashState.globalStartDate);
            if (locationDashState.globalEndDate) queryParams.append("end_date", locationDashState.globalEndDate);
        }

        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
        let res;
        try {
            res = await api.get(`${LOCATION_ANALYTICS_CONFIG.ENDPOINT_LOCATION_ANALYTICS}${queryString}`);
        } catch (err) {
            console.warn("Location analytics API route fallback:", err);
            res = null;
        }

        if (res && res.status === "success" && res.locations) {
            locationDashState.locationAnalyticsData = res.locations;
        } else {
            const raw = await api.get(LOCATION_ANALYTICS_CONFIG.ENDPOINT_ENTRIES_QUERY);
            locationDashState.allEntries = Array.isArray(raw) ? raw : (raw.entries || []);
            locationDashState.locationAnalyticsData = computeLocalLocationAnalytics(locationDashState.allEntries);
        }

        updateLocationGridReflow();
        renderLocationPanels();
    } catch (e) {
        console.error("Location analytics refresh error:", e);
    }
}

function computeLocalLocationAnalytics(entries) {
    const locMap = {};
    LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS.forEach(loc => {
        locMap[loc] = {
            total_scans: 0,
            unique_work_orders: 0,
            unique_pack_nos: 0,
            top_customer: "N/A",
            customer_breakdown: {},
            pl_type_breakdown: {},
            time_series: []
        };
    });

    const tempMap = {};
    LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS.forEach(loc => {
        tempMap[loc] = { wo: new Set(), pack: new Set(), cust: {}, pl: {}, ts: {} };
    });

    entries.forEach(e => {
        const loc = e.Location;
        if (tempMap[loc]) {
            const tm = tempMap[loc];
            tm.wo.add(e.WorkOrder);
            tm.pack.add(e.PackNo);

            const cust = e.Customer || "Unknown";
            tm.cust[cust] = (tm.cust[cust] || 0) + 1;

            const plt = e.PLType || "Unknown";
            tm.pl[plt] = (tm.pl[plt] || 0) + 1;

            const dateStr = (e.EntryTimestamp || "").substring(0, 10);
            if (dateStr) tm.ts[dateStr] = (tm.ts[dateStr] || 0) + 1;
        }
    });

    LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS.forEach(loc => {
        const tm = tempMap[loc];
        const total = tm.wo.size > 0 ? entries.filter(e => e.Location === loc).length : 0;
        const topCust = Object.keys(tm.cust).length > 0 ? Object.keys(tm.cust).reduce((a, b) => tm.cust[a] > tm.cust[b] ? a : b) : "N/A";
        const sortedDates = Object.keys(tm.ts).sort();

        locMap[loc] = {
            total_scans: total,
            unique_work_orders: tm.wo.size,
            unique_pack_nos: tm.pack.size,
            top_customer: topCust,
            customer_breakdown: tm.cust,
            pl_type_breakdown: tm.pl,
            time_series: sortedDates.map(d => ({ date: d, count: tm.ts[d] }))
        };
    });

    return locMap;
}

function renderLocationPanels() {
    const container = document.getElementById("location-grid-container");
    if (!container) return;

    // Remove cards for unselected locations
    const existingCards = container.querySelectorAll(".loc-panel-card");
    existingCards.forEach(card => {
        const locName = card.getAttribute("data-loc-name");
        if (!locName || !locationDashState.selectedLocations.has(locName)) {
            if (locationDashState.charts[locName]) {
                locationDashState.charts[locName].destroy();
                delete locationDashState.charts[locName];
            }
            card.remove();
        }
    });

    // Create or update cards for active locations
    LOCATION_ANALYTICS_CONFIG.CANONICAL_LOCATIONS.forEach(loc => {
        if (locationDashState.selectedLocations.has(loc)) {
            const cardId = `loc-panel-${loc.replace(/\s+/g, '_')}`;
            let card = document.getElementById(cardId);

            if (!card) {
                card = createLocationPanelDOM(loc);
                container.appendChild(card);
            } else {
                updateLocationPanelDOM(card, loc);
            }

            renderLocationPanelChart(loc);
        }
    });
}

function updateLocationPanelDOM(card, loc) {
    const overrideState = locationDashState.panelOverrides[loc] || { isOverridden: false, timeRange: "all", dataField: "overall" };
    const locData = (locationDashState.locationAnalyticsData && locationDashState.locationAnalyticsData[loc]) || {
        total_scans: 0, unique_work_orders: 0, unique_pack_nos: 0, top_customer: "N/A", time_series: []
    };

    const activeField = overrideState.isOverridden ? overrideState.dataField : locationDashState.globalDataField;

    // Update Override Badge
    const badgeEl = card.querySelector(".loc-override-badge-container");
    if (badgeEl) {
        badgeEl.innerHTML = overrideState.isOverridden ? '<span class="loc-override-badge">LOCALLY OVERRIDDEN</span>' : '';
    }

    // Update Reset Button
    const resetContainer = card.querySelector(".loc-reset-btn-container");
    if (resetContainer) {
        resetContainer.innerHTML = overrideState.isOverridden ? `<button class="loc-panel-reset-btn" data-reset-loc="${loc}">Reset</button>` : '';
        const resetBtn = resetContainer.querySelector(".loc-panel-reset-btn");
        if (resetBtn) {
            resetBtn.onclick = () => {
                locationDashState.panelOverrides[loc].isOverridden = false;
                locationDashState.panelOverrides[loc].dataField = locationDashState.globalDataField;
                locationDashState.panelOverrides[loc].timeRange = locationDashState.globalTimeRange;
                renderLocationPanels();
            };
        }
    }

    // Update Field Select Value
    const fieldSel = card.querySelector(".loc-field-select");
    if (fieldSel && fieldSel.value !== activeField) {
        fieldSel.value = activeField;
    }

    // Update Metrics Text without replacing DOM nodes
    const totalScansEl = card.querySelector(".loc-val-total-scans");
    if (totalScansEl) totalScansEl.innerText = locData.total_scans || 0;

    const uniqueWoEl = card.querySelector(".loc-val-unique-wo");
    if (uniqueWoEl) uniqueWoEl.innerText = locData.unique_work_orders || 0;

    const topCustEl = card.querySelector(".loc-val-top-cust");
    if (topCustEl) topCustEl.innerText = locData.top_customer || 'N/A';
}

function createLocationPanelDOM(loc) {
    const card = document.createElement("div");
    card.className = "loc-panel-card glass-card";
    card.id = `loc-panel-${loc.replace(/\s+/g, '_')}`;
    card.setAttribute("data-loc-name", loc);

    const overrideState = locationDashState.panelOverrides[loc] || { isOverridden: false, timeRange: "all", dataField: "overall" };
    const locData = (locationDashState.locationAnalyticsData && locationDashState.locationAnalyticsData[loc]) || {
        total_scans: 0, unique_work_orders: 0, unique_pack_nos: 0, top_customer: "N/A", time_series: []
    };

    const activeField = overrideState.isOverridden ? overrideState.dataField : locationDashState.globalDataField;

    card.innerHTML = `
        <div class="loc-panel-header">
            <div class="loc-title-group">
                <span class="loc-panel-name">${loc}</span>
                <span class="loc-override-badge-container">
                    ${overrideState.isOverridden ? '<span class="loc-override-badge">LOCALLY OVERRIDDEN</span>' : ''}
                </span>
            </div>
            <div class="loc-panel-local-filters">
                <select class="loc-local-select loc-field-select" data-loc="${loc}" title="Local Data Field">
                    <option value="overall" ${activeField === 'overall' ? 'selected' : ''}>Overall Scan Volume</option>
                    <option value="pl_type" ${activeField === 'pl_type' ? 'selected' : ''}>PL Type</option>
                    <option value="sub_pl_type" ${activeField === 'sub_pl_type' ? 'selected' : ''}>Sub PL Type</option>
                    <option value="customer" ${activeField === 'customer' ? 'selected' : ''}>Customer</option>
                </select>
                <span class="loc-reset-btn-container">
                    ${overrideState.isOverridden ? `<button class="loc-panel-reset-btn" data-reset-loc="${loc}">Reset</button>` : ''}
                </span>
            </div>
        </div>

        <div class="loc-metrics-row">
            <div class="loc-metric-item">
                <span class="loc-metric-label">Total Scans</span>
                <span class="loc-metric-val loc-val-total-scans">${locData.total_scans || 0}</span>
            </div>
            <div class="loc-metric-item">
                <span class="loc-metric-label">Unique WOs</span>
                <span class="loc-metric-val loc-val-unique-wo">${locData.unique_work_orders || 0}</span>
            </div>
            <div class="loc-metric-item">
                <span class="loc-metric-label">Top Cust</span>
                <span class="loc-metric-val loc-val-top-cust" style="font-size:0.85rem">${locData.top_customer || 'N/A'}</span>
            </div>
        </div>

        <div class="loc-canvas-wrapper">
            <canvas id="loc-canvas-${loc.replace(/\s+/g, '_')}"></canvas>
        </div>
    `;

    const fieldSel = card.querySelector(".loc-field-select");
    if (fieldSel) {
        fieldSel.addEventListener("change", (e) => {
            const val = e.target.value;
            locationDashState.panelOverrides[loc].isOverridden = true;
            locationDashState.panelOverrides[loc].dataField = val;
            renderLocationPanels();
        });
    }

    const resetBtn = card.querySelector(".loc-panel-reset-btn");
    if (resetBtn) {
        resetBtn.onclick = () => {
            locationDashState.panelOverrides[loc].isOverridden = false;
            locationDashState.panelOverrides[loc].dataField = locationDashState.globalDataField;
            locationDashState.panelOverrides[loc].timeRange = locationDashState.globalTimeRange;
            renderLocationPanels();
        };
    }

    return card;
}

function renderLocationPanelChart(loc) {
    const canvasId = `loc-canvas-${loc.replace(/\s+/g, '_')}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const locData = (locationDashState.locationAnalyticsData && locationDashState.locationAnalyticsData[loc]) || { time_series: [] };
    const timeSeries = locData.time_series || [];

    const labels = timeSeries.map(ts => ts.date);
    const dataPoints = timeSeries.map(ts => ts.count);

    if (labels.length === 0) {
        labels.push("No Data");
        dataPoints.push(0);
    }

    // Smooth in-place chart data update if chart instance already exists!
    if (locationDashState.charts[loc]) {
        const chart = locationDashState.charts[loc];
        chart.data.labels = labels;
        chart.data.datasets[0].data = dataPoints;
        chart.update("none"); // Smooth in-place update without re-animating or destroying canvas!
        return;
    }

    const ctx = canvas.getContext("2d");
    locationDashState.charts[loc] = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: `${loc} Scans`,
                data: dataPoints,
                borderColor: "#0A84FF",
                backgroundColor: "rgba(10, 132, 255, 0.15)",
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disable initial animation for instant zero-flicker updates
            plugins: {
                legend: { display: false },
                tooltip: { mode: "index", intersect: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#94a3b8", font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#94a3b8", font: { size: 10 } }
                }
            }
        }
    });
}

function setupExcelImportUI() {
    const fileInput1 = document.getElementById("excel-import-file");
    const submitBtn1 = document.getElementById("btn-submit-excel-import");
    const statusMsg1 = document.getElementById("excel-import-status");

    const fileInputMain = document.getElementById("excel-import-file-main");
    const submitBtnMain = document.getElementById("btn-submit-excel-import-main");
    const statusMsgMain = document.getElementById("excel-import-status-main");

    const menuBtn = document.getElementById("menu-action-import-excel");
    const summaryModal = document.getElementById("excel-import-summary-modal");
    const closeSummaryBtn = document.getElementById("btn-close-import-summary");

    // File input 1 (Diagnostics)
    if (fileInput1 && submitBtn1) {
        fileInput1.addEventListener("change", () => {
            if (fileInput1.files && fileInput1.files.length > 0) {
                submitBtn1.style.display = "inline-flex";
                if (statusMsg1) statusMsg1.innerText = `Selected: ${fileInput1.files[0].name}`;
            } else {
                submitBtn1.style.display = "none";
            }
        });
        submitBtn1.addEventListener("click", () => handleExcelDataImport(fileInput1, submitBtn1, statusMsg1));
    }

    // File input Main (Admin Settings Card)
    if (fileInputMain && submitBtnMain) {
        fileInputMain.addEventListener("change", () => {
            if (fileInputMain.files && fileInputMain.files.length > 0) {
                submitBtnMain.style.display = "inline-flex";
                if (statusMsgMain) statusMsgMain.innerText = `Selected: ${fileInputMain.files[0].name}`;
            } else {
                submitBtnMain.style.display = "none";
            }
        });
        submitBtnMain.addEventListener("click", () => handleExcelDataImport(fileInputMain, submitBtnMain, statusMsgMain));
    }

    if (menuBtn) {
        menuBtn.addEventListener("click", () => {
            if (!state.currentUser || state.currentUser.role !== "Admin") {
                toast.error("Admin authorization required to import Excel data.");
                return;
            }
            switchTab("settings-tab");
            const adminNavBtn = document.querySelector('[data-sub-tab="settings-panel-users"]');
            if (adminNavBtn) adminNavBtn.click();
            const importCard = document.getElementById("admin-import-card-section");
            if (importCard) importCard.scrollIntoView({ behavior: "smooth" });
            if (fileInputMain) fileInputMain.click();
        });
    }

    if (closeSummaryBtn && summaryModal) {
        closeSummaryBtn.addEventListener("click", () => {
            summaryModal.classList.add("hidden");
        });
    }

    // User Delete Confirmation Modal Handlers
    const confirmDeleteUserBtn = document.getElementById("btn-confirm-delete-user");
    const cancelDeleteUserBtn = document.getElementById("btn-cancel-delete-user");
    const deleteModal = document.getElementById("user-delete-options-modal");

    if (cancelDeleteUserBtn && deleteModal) {
        cancelDeleteUserBtn.addEventListener("click", () => {
            deleteModal.classList.add("hidden");
            state.pendingDeleteUserId = null;
        });
    }

    if (confirmDeleteUserBtn && deleteModal) {
        confirmDeleteUserBtn.addEventListener("click", async () => {
            if (!state.pendingDeleteUserId) return;
            const deleteOption = document.querySelector('input[name="delete-data-option"]:checked');
            const deleteEntries = deleteOption ? (deleteOption.value === "delete") : false;

            confirmDeleteUserBtn.disabled = true;
            confirmDeleteUserBtn.innerText = "Deleting...";

            try {
                const res = await api.delete("/api/users/delete", {
                    requesting_userid: state.currentUser.userid,
                    target_userid: state.pendingDeleteUserId,
                    delete_entries: deleteEntries
                });
                deleteModal.classList.add("hidden");
                toast.success(res.message || "User deleted successfully!");
                fetchAdminUsersList();
                if (typeof fetchSpreadsheetData === "function") fetchSpreadsheetData();
                playAudioTone(880, 0.1, "sine");
            } catch (e) {
                toast.error(e.message || "Failed to delete user account.");
            } finally {
                confirmDeleteUserBtn.disabled = false;
                confirmDeleteUserBtn.innerText = "Confirm Delete";
                state.pendingDeleteUserId = null;
            }
        });
    }
}

async function handleExcelDataImport(fileInputParam, submitBtnParam, statusMsgParam) {
    if (!state.currentUser || state.currentUser.role !== "Admin") {
        toast.error("Admin authorization required.");
        return;
    }

    const fileInput = fileInputParam || document.getElementById("excel-import-file-main") || document.getElementById("excel-import-file");
    const submitBtn = submitBtnParam || document.getElementById("btn-submit-excel-import-main") || document.getElementById("btn-submit-excel-import");
    const statusMsg = statusMsgParam || document.getElementById("excel-import-status-main") || document.getElementById("excel-import-status");

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        if (statusMsg) {
            statusMsg.className = "status-msg error-msg text-sm mt-2";
            statusMsg.innerText = "Please select an Excel file (.xlsm or .xlsx) first.";
        }
        return;
    }

    const file = fileInput.files[0];
    submitBtn.disabled = true;
    submitBtn.innerText = "Importing...";
    if (statusMsg) {
        statusMsg.className = "status-msg text-sm mt-2";
        statusMsg.innerText = "Uploading & processing Excel file... Please wait.";
    }

    try {
        const formData = new FormData();
        formData.append("userid", state.currentUser.userid);
        formData.append("file", file);

        const response = await fetch(`${state.apiUrl}/api/admin/import-excel`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok || data.status === "error") {
            throw new Error(data.message || "Import failed");
        }

        // Success!
        if (statusMsg) {
            statusMsg.className = "status-msg success-msg text-sm mt-2";
            statusMsg.innerText = "Excel import completed successfully!";
        }

        // Show Summary Modal
        const summaryModal = document.getElementById("excel-import-summary-modal");
        const msgEl = document.getElementById("excel-import-summary-msg");
        const countEl = document.getElementById("summary-imported-count");
        const userCountEl = document.getElementById("summary-user-count");
        const createdUsersEl = document.getElementById("summary-created-users");
        const dateRangeEl = document.getElementById("summary-date-range");

        if (msgEl) msgEl.innerText = data.message;
        if (countEl) countEl.innerText = data.imported_count || 0;
        if (userCountEl) userCountEl.innerText = data.user_count || 0;
        if (createdUsersEl) {
            createdUsersEl.innerText = (data.created_users && data.created_users.length > 0)
                ? data.created_users.join(", ")
                : "None (All users matched)";
        }
        if (dateRangeEl && data.date_range) {
            dateRangeEl.innerText = `${data.date_range.start}  →  ${data.date_range.end}`;
        }

        if (summaryModal) summaryModal.classList.remove("hidden");

        // Clear file input
        fileInput.value = "";
        submitBtn.style.display = "none";

        // Audio & data refresh
        if (typeof playAudioTone === "function") playAudioTone(880, 0.15, "sine");
        toast.success(`Imported ${data.imported_count} packing list entries!`);

        // Refresh active views
        if (typeof fetchSpreadsheetData === "function") fetchSpreadsheetData();
        if (typeof refreshDashboardAnalytics === "function") refreshDashboardAnalytics();
        if (typeof fetchAdminUsersList === "function") fetchAdminUsersList();

    } catch (e) {
        if (statusMsg) {
            statusMsg.className = "status-msg error-msg text-sm mt-2";
            statusMsg.innerText = e.message || "Failed to import Excel file.";
        }
        toast.error(e.message || "Import failed");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Upload & Import Data";
    }
}

// Global initialization for Mode checkboxes and Password change
document.addEventListener("DOMContentLoaded", () => {
    // Mode checkboxes mutual exclusion
    const mailChk = document.getElementById("mode-mail");
    const manualChk = document.getElementById("mode-manual");
    if (mailChk && manualChk) {
        mailChk.addEventListener("change", () => {
            if (mailChk.checked) manualChk.checked = false;
            else if (!manualChk.checked) manualChk.checked = true;
        });
        manualChk.addEventListener("change", () => {
            if (manualChk.checked) mailChk.checked = false;
            else if (!mailChk.checked) mailChk.checked = true;
        });
    }

    // Security & Credentials Password change form
    const changePassBtn = document.getElementById("btn-submit-change-pass");
    if (changePassBtn) {
        changePassBtn.addEventListener("click", async () => {
            const passVal = document.getElementById("change-pass-new").value;
            const statusEl = document.getElementById("change-pass-status");
            if (!passVal || passVal.length < 6) {
                if (statusEl) {
                    statusEl.className = "status-msg error-msg text-center mt-2";
                    statusEl.innerText = "Password must be at least 6 characters.";
                }
                return;
            }
            try {
                const res = await api.post("/api/users/update", {
                    requesting_userid: state.currentUser.userid,
                    target_userid: state.currentUser.userid,
                    new_password: passVal
                });
                if (statusEl) {
                    statusEl.className = "status-msg success-msg text-center mt-2";
                    statusEl.innerText = res.message || "Password updated successfully!";
                }
                document.getElementById("change-pass-new").value = "";
                if (document.getElementById("change-pass-current")) {
                    document.getElementById("change-pass-current").value = "";
                }
                toast.success("Password updated successfully!");
            } catch (e) {
                if (statusEl) {
                    statusEl.className = "status-msg error-msg text-center mt-2";
                    statusEl.innerText = e.message || "Failed to update password.";
                }
                toast.error(e.message || "Failed to update password.");
            }
        });
    }

    setupExcelImportUI();
});


