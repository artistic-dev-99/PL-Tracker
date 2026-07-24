// Settings, Theme & Preferences Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';
import { updateApiUrl, applyStatusBarMode } from '../utils/domUtils.js';
import { playUnifiedAudioTone } from '../utils/audio.js';
import { checkServerConnection } from './auth.js';

let isSettingsInitialized = false;

export function initializeSettingsTab() {
    queryDbFileSize();
    if (window.fetchAdminUsersList) {
        window.fetchAdminUsersList();
    }

    const adminNavBtn = document.getElementById("settings-nav-admin");
    const adminSection = document.getElementById("admin-settings-section");
    const isAdmin = state.currentUser && state.currentUser.role === "Admin";
    if (adminNavBtn) adminNavBtn.style.display = isAdmin ? "flex" : "none";
    if (adminSection) adminSection.style.display = isAdmin ? "block" : "none";

    if (isSettingsInitialized) return;
    isSettingsInitialized = true;

    // Settings Subtab Switching
    document.querySelectorAll(".settings-sub-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const subtabId = btn.getAttribute("data-sub-tab");
            document.querySelectorAll(".settings-sub-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".settings-sub-panel").forEach(p => p.classList.add("hidden"));
            document.querySelectorAll(".settings-sub-panel").forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const panel = document.getElementById(subtabId);
            if (panel) {
                panel.classList.remove("hidden");
                panel.classList.add("active");
            }
        });
    });

    // Theme & Typography Selectors
    const themeSelect = document.getElementById("theme-preset-select");
    if (themeSelect) {
        themeSelect.value = localStorage.getItem("pref_theme") || "dark";
        themeSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            localStorage.setItem("pref_theme", val);
            applyTheme(val);
        });
    }

    const fontSelect = document.getElementById("theme-font-select");
    if (fontSelect) {
        fontSelect.value = localStorage.getItem("pref_font") || "serif";
        fontSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            localStorage.setItem("pref_font", val);
            applyFont(val);
        });
    }

    // Accent Color Swatches
    document.querySelectorAll(".accent-swatch-btn").forEach(swatch => {
        swatch.addEventListener("click", () => {
            const accent = swatch.getAttribute("data-accent");
            if (accent) {
                localStorage.setItem("pref_accent", accent);
                applyAccent(accent);
            }
        });
    });

    // Preferences Form Save
    const savePrefBtn = document.getElementById("save-preferences-btn");
    if (savePrefBtn) {
        savePrefBtn.addEventListener("click", () => {
            const defaultLoc = document.getElementById("pref-default-location")?.value || "";
            const defaultCust = document.getElementById("pref-default-customer")?.value || "";
            const defaultPL = document.getElementById("pref-default-pltype")?.value || "";
            const tone = document.getElementById("pref-audio-tone")?.value || "chime";
            const beeps = document.getElementById("pref-enable-beeps")?.checked ?? true;
            const autoClear = document.getElementById("pref-auto-clear")?.checked ?? true;

            localStorage.setItem("pref_default_location", defaultLoc);
            localStorage.setItem("pref_default_customer", defaultCust);
            localStorage.setItem("pref_default_pltype", defaultPL);
            localStorage.setItem("pref_audio_tone", tone);
            localStorage.setItem("pref_enable_beeps", beeps ? "true" : "false");
            localStorage.setItem("pref_auto_clear", autoClear ? "true" : "false");

            toast.success("Preferences saved successfully!");
        });
    }

    // Change Password Form
    const passBtn = document.getElementById("btn-submit-change-pass");
    if (passBtn) {
        passBtn.addEventListener("click", async () => {
            const currentPass = document.getElementById("change-pass-current")?.value || "";
            const newPass = document.getElementById("change-pass-new")?.value || "";
            const statusEl = document.getElementById("change-pass-status");

            if (!currentPass || !newPass) {
                toast.error("Please fill in both current and new password fields.");
                return;
            }

            try {
                const res = await api.post("/api/users/update", {
                    userid: state.currentUser.userid,
                    current_password: currentPass,
                    password: newPass
                });
                if (res && res.status === "success") {
                    toast.success("Password updated successfully!");
                    if (statusEl) statusEl.innerText = "Password updated successfully.";
                    const cEl = document.getElementById("change-pass-current");
                    const nEl = document.getElementById("change-pass-new");
                    if (cEl) cEl.value = "";
                    if (nEl) nEl.value = "";
                } else {
                    toast.error(res.message || "Failed to update password.");
                }
            } catch (err) {
                toast.error("Error updating password.");
            }
        });
    }
}

export async function queryDbFileSize() {
    try {
        const data = await api.get("/api/db-status");
        const dbSizeEl = document.getElementById("meta-db-size");
        if (dbSizeEl && data.db_size_mb !== undefined) {
            dbSizeEl.innerText = `${data.db_size_mb} MB`;
        }
    } catch (e) {
        console.warn("Failed to query DB size:", e);
    }
}

export function applyAccent(accentColor) {
    const accent = accentColor || localStorage.getItem("pref_accent") || "#FF4500";
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-hover", accent);

    const hex = accent.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const rgba = (a) => `rgba(${r}, ${g}, ${b}, ${a})`;

    root.style.setProperty("--accent-subtle", rgba(0.12));
    root.style.setProperty("--tint-accent", rgba(0.12));

    document.querySelectorAll(".accent-swatch-btn").forEach(s => {
        if (s.getAttribute("data-accent") === accent) {
            s.classList.add("active");
        } else {
            s.classList.remove("active");
        }
    });
}

export function applyFont(fontChoice) {
    const choice = fontChoice || localStorage.getItem("pref_font") || "serif";
    if (choice === "sans") {
        document.documentElement.style.setProperty("--font-serif", "var(--font-system)");
    } else {
        document.documentElement.style.setProperty("--font-serif", "'Playfair Display', Georgia, serif");
    }
    const fontSelect = document.getElementById("theme-font-select");
    if (fontSelect) fontSelect.value = choice;
}

export function applyTheme(themeChoice) {
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

    const themeSelect = document.getElementById("theme-preset-select");
    if (themeSelect) themeSelect.value = selectedTheme;
}

export function handleSaveSettings() {
    const ip = document.getElementById("settings-ip")?.value.trim() || "";
    const port = parseInt(document.getElementById("settings-port")?.value.trim() || "", 10);

    if (!ip || isNaN(port)) {
        toast.error("Invalid IP Address or Port");
        return;
    }

    state.serverIp = ip;
    state.serverPort = port;
    updateApiUrl();

    if (window.pywebview && window.pywebview.api && window.pywebview.api.save_config) {
        pywebview.api.save_config({ server_ip: ip, server_port: port }).then(() => {
            const modal = document.getElementById("settings-modal");
            if (modal) modal.classList.add("hidden");
            checkServerConnection();
        });
    } else {
        const modal = document.getElementById("settings-modal");
        if (modal) modal.classList.add("hidden");
        checkServerConnection();
    }
}

export async function handleDownloadDbBackup() {
    try {
        const a = document.createElement("a");
        a.href = `${state.apiUrl}/api/admin/backup?userid=${state.currentUser.userid}`;
        a.download = `pl_tracker_backup_${new Date().toISOString().slice(0, 10)}.db`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Database backup downloaded!");
    } catch (e) {
        toast.error("Backup download failed.");
    }
}

if (typeof window !== "undefined") {
    window.initializeSettingsTab = initializeSettingsTab;
    window.queryDbFileSize = queryDbFileSize;
    window.applyAccent = applyAccent;
    window.applyFont = applyFont;
    window.applyTheme = applyTheme;
    window.handleSaveSettings = handleSaveSettings;
    window.handleDownloadDbBackup = handleDownloadDbBackup;
}
