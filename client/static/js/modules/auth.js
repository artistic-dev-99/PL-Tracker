// User Authentication, Setup & Session Module
import { state } from '../state.js';
import { api } from '../api.js';
import { showStatusIndicator, showOfflineBanner, hideOfflineBanner } from '../utils/domUtils.js';
import { toast } from '../utils/toast.js';

export async function checkServerConnection() {
    showStatusIndicator("connecting", "Connecting...");

    try {
        const data = await api.get("/api/db-status", { timeout: 2000 });
        showStatusIndicator("connected", "Connected");
        hideOfflineBanner();

        if (data.db_empty) {
            showScreen("first-time-screen");
            const adminUserEl = document.getElementById("admin-setup-username");
            if (adminUserEl) adminUserEl.focus();
        } else {
            showScreen("login-screen");
            const remembered = localStorage.getItem("remembered_username");
            const passEl = document.getElementById("login-password");
            const userEl = document.getElementById("login-username");
            if (remembered && passEl) {
                passEl.focus();
            } else if (userEl) {
                userEl.focus();
            }
        }
    } catch (err) {
        showStatusIndicator("disconnected", "Database unreachable");
        showScreen("setup-screen");
        const setupIpEl = document.getElementById("setup-ip");
        if (setupIpEl) setupIpEl.focus();
    }
}

export function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.remove("hidden");
}
if (typeof window !== "undefined") {
    window.showScreen = showScreen;
}

export async function handleLogin() {
    const userEl = document.getElementById("login-username");
    const passEl = document.getElementById("login-password");

    const username = userEl ? userEl.value.trim() : "";
    const password = passEl ? passEl.value : "";

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
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Signing In...";
    }
    const statusEl = document.getElementById("login-status");
    if (statusEl) statusEl.innerText = "";

    try {
        const data = await api.post("/api/auth/login", { username, password });
        state.currentUser = data.user;

        const rememberMe = document.getElementById("remember-me")?.checked;
        if (rememberMe) {
            localStorage.setItem("remembered_username", username);
        } else {
            localStorage.removeItem("remembered_username");
        }

        const usernameDisplay = document.getElementById("username-display");
        if (usernameDisplay) usernameDisplay.innerText = state.currentUser.username;
        const badge = document.getElementById("user-badge");
        if (badge) {
            badge.innerText = state.currentUser.role;
            badge.className = "badge " + (state.currentUser.role === "Admin" ? "admin-badge" : "local-badge");
        }

        const avatarInitial = document.getElementById("user-avatar-initial");
        if (avatarInitial && state.currentUser.username) {
            avatarInitial.innerText = state.currentUser.username.charAt(0).toUpperCase();
        }

        showScreen("main-app");
        if (window.switchTab) window.switchTab("entry-form-tab");

        const woEl = document.getElementById("entry-workorder");
        if (woEl) woEl.focus();
        if (window.resetEntryForm) window.resetEntryForm();
    } catch (err) {
        const errMsg = err.message || "Authentication failed";
        const errType = err.data && err.data.error_type;

        if (errType === "username") {
            showError("login-username", errMsg);
        } else if (errType === "password") {
            showError("login-password", errMsg);
        } else if (statusEl) {
            statusEl.className = "status-msg error-msg text-center mt-3";
            statusEl.innerText = errMsg;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Sign In";
        }
    }
}

export async function handleFirstTimeSetup() {
    const user = document.getElementById("admin-setup-username")?.value.trim() || "";
    const pass = document.getElementById("admin-setup-password")?.value || "";

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
        await api.post("/api/auth/setup", { username: user, password: pass });
        const statusEl = document.getElementById("first-time-status");
        if (statusEl) {
            statusEl.className = "status-msg success-msg text-center mt-3";
            statusEl.innerText = "Admin created! Redirecting...";
        }
        setTimeout(() => {
            showScreen("login-screen");
            const loginUserEl = document.getElementById("login-username");
            if (loginUserEl) loginUserEl.value = user;
            const loginPassEl = document.getElementById("login-password");
            if (loginPassEl) loginPassEl.focus();
        }, 1500);
    } catch (e) {
        showError("admin-setup-username", e.message || "Failed to connect to server");
    }
}

export async function handleRegisterNewUser() {
    const adminUser = document.getElementById("reg-admin-username")?.value.trim() || "";
    const adminPass = document.getElementById("reg-admin-password")?.value || "";
    const newUsername = document.getElementById("reg-new-username")?.value.trim() || "";
    const newPassword = document.getElementById("reg-new-password")?.value || "";
    const newRole = document.getElementById("reg-new-role")?.value || "Local";

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
    if (statusEl) {
        statusEl.innerText = "Registering user...";
        statusEl.className = "status-msg text-center mt-3";
    }

    try {
        const data = await api.post("/api/auth/register", {
            admin_username: adminUser,
            admin_password: adminPass,
            new_username: newUsername,
            new_password: newPassword,
            new_role: newRole
        });

        if (statusEl) {
            statusEl.className = "status-msg success-msg text-center mt-3";
            statusEl.innerText = data.message;
        }
        const regUser = document.getElementById("reg-new-username");
        const regPass = document.getElementById("reg-new-password");
        if (regUser) regUser.value = "";
        if (regPass) regPass.value = "";
        setTimeout(() => {
            showScreen("login-screen");
        }, 2000);
    } catch (e) {
        if (statusEl) {
            statusEl.className = "status-msg error-msg text-center mt-3";
            statusEl.innerText = e.message || "Failed to communicate with server";
        }
    }
}

export function handleLogout() {
    state.currentUser = null;
    showScreen("login-screen");
    toast.info("Logged out successfully");
}

export function showError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) {
        errorEl.innerText = message;
    }
}

export function clearError(fieldId) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) {
        errorEl.innerText = "";
    }
}

if (typeof window !== "undefined") {
    window.checkServerConnection = checkServerConnection;
    window.handleLogin = handleLogin;
    window.handleFirstTimeSetup = handleFirstTimeSetup;
    window.handleRegisterNewUser = handleRegisterNewUser;
    window.handleLogout = handleLogout;
    window.showError = showError;
    window.clearError = clearError;
}
