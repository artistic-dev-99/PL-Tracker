// Settings, Theme & Preferences Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';
import { updateApiUrl, applyStatusBarMode } from '../utils/domUtils.js';
import { playUnifiedAudioTone } from '../utils/audio.js';
import { checkServerConnection } from './auth.js';

export function initializeSettingsTab() {
    queryDbFileSize();
    if (window.fetchAdminUsersList) {
        window.fetchAdminUsersList();
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
