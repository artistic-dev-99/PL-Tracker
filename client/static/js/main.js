// PL Tracker — Main Application Bootstrapper
import { state } from './state.js';
import { mountAllComponents } from './componentRegistry.js';
import { initPyWebViewBridge } from './bridge.js';
import { checkServerConnection, handleLogin, handleFirstTimeSetup, handleRegisterNewUser, handleLogout } from './modules/auth.js';
import { submitEntry, updateEntry, confirmDeleteEntry, saveAsNewEntry, resetEntryForm, resetEntryFormFields, toggleSearchMode, executeEntrySearch, cycleSearchRecord, handlePLTypeChange, formatAndValidateDate, formatAndValidateTime } from './modules/entryForm.js';
import { fetchSpreadsheetData, renderSpreadsheet, toggleSelectAllEntries, handleSpreadsheetSort } from './modules/spreadsheet.js';
import { triggerBulkModify, triggerBulkDelete, cycleBulkRecord, commitBulkAllChanges } from './modules/bulkEdit.js';
import { refreshDashboardAnalytics, updateUserDashboardView } from './modules/analytics.js';
import { setupExcelImportUI } from './modules/excelImport.js';
import { fetchAdminUsersList, handleAdminCreateUser } from './modules/userManagement.js';
import { initializeSettingsTab, applyTheme, applyAccent, applyFont } from './modules/settings.js';
import { applyStatusBarMode } from './utils/domUtils.js';
import { playUnifiedAudioTone } from './utils/audio.js';
import { toast } from './utils/toast.js';

export function initApp() {
    setupTabNavigation();
    setupEventHandlers();
    setupShortcutListeners();
    setupExcelImportUI();
    loadLocalStorageSettings();

    initPyWebViewBridge(checkServerConnection);
}

export function toggleSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
        sidebar.classList.toggle("collapsed");
        localStorage.setItem("sidebar_collapsed", sidebar.classList.contains("collapsed"));
    }
}

function setupTabNavigation() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            if (tabId) switchTab(tabId);
        });
    });

    const collapseBtn = document.getElementById("sidebar-collapse-btn");
    if (collapseBtn) {
        collapseBtn.addEventListener("click", toggleSidebar);
    }

    const menuToggleSidebar = document.getElementById("menu-action-toggle-sidebar");
    if (menuToggleSidebar) {
        menuToggleSidebar.addEventListener("click", toggleSidebar);
    }
}

export function switchTab(tabId) {
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
    if (titleEl && titleMap[tabId]) titleEl.innerText = titleMap[tabId];

    const modeInfoEl = document.getElementById("sb-mode-info");
    if (modeInfoEl && titleMap[tabId]) modeInfoEl.innerText = titleMap[tabId];

    state.currentTab = tabId;

    if (tabId === "previous-entries-tab") {
        fetchSpreadsheetData();
    } else if (tabId === "dashboard-tab") {
        refreshDashboardAnalytics();
    } else if (tabId === "settings-tab") {
        initializeSettingsTab();
    }
}

function loadLocalStorageSettings() {
    const remembered = localStorage.getItem("remembered_username");
    if (remembered) {
        const loginUserEl = document.getElementById("login-username");
        const rememberEl = document.getElementById("remember-me");
        if (loginUserEl) loginUserEl.value = remembered;
        if (rememberEl) rememberEl.checked = true;
    }

    const dontShowDelete = localStorage.getItem("dont_show_delete_confirm");
    if (dontShowDelete === "true") {
        state.confirmDelete = false;
        const confirmCb = document.getElementById("confirm-dont-show");
        if (confirmCb) confirmCb.checked = true;
    }

    if (localStorage.getItem("sidebar_collapsed") === "true") {
        const sidebar = document.getElementById("app-sidebar");
        if (sidebar) sidebar.classList.add("collapsed");
    }

    applyTheme();
    applyAccent();
    applyFont();
}

function setupShortcutListeners() {
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
            const activeTag = document.activeElement ? document.activeElement.tagName : "";
            if (activeTag !== "INPUT" && activeTag !== "TEXTAREA" && activeTag !== "SELECT") {
                e.preventDefault();
                toggleSidebar();
            }
        }
        if (e.key === "F11" && !e.ctrlKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab") toggleSearchMode();
        }

        if (e.key === "F11" && e.ctrlKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab" && state.searchMode) executeEntrySearch();
        }

        if (e.key === "Enter" && e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab") {
                if (state.searchMode) updateEntry();
                else submitEntry();
            }
        }

        if (e.key === "Enter" && e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab" && state.searchMode) saveAsNewEntry();
        }

        if (e.key === "Delete" && e.ctrlKey) {
            e.preventDefault();
            if (state.currentTab === "entry-form-tab" && state.activeEntryId) confirmDeleteEntry();
        }

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

function setupEventHandlers() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            handleLogin();
        });
    }

    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", (e) => {
            e.preventDefault();
            handleLogin();
        });
    }

    const regBtn = document.getElementById("go-to-register-btn");
    if (regBtn) regBtn.addEventListener("click", () => window.showScreen("register-screen"));

    const cancelRegBtn = document.getElementById("cancel-register-btn");
    if (cancelRegBtn) cancelRegBtn.addEventListener("click", () => window.showScreen("login-screen"));

    const doRegBtn = document.getElementById("register-btn");
    if (doRegBtn) doRegBtn.addEventListener("click", handleRegisterNewUser);

    const createAdminBtn = document.getElementById("create-admin-btn");
    if (createAdminBtn) createAdminBtn.addEventListener("click", handleFirstTimeSetup);

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const isCurrentlyLight = document.documentElement.classList.contains("light-mode");
            const nextTheme = isCurrentlyLight ? "dark" : "light";
            localStorage.setItem("pref_theme", nextTheme);
            applyTheme(nextTheme);
            toast.info(`Switched to ${nextTheme === "light" ? "Light" : "Dark"} theme.`);
        });
    }

    const submitEntryBtn = document.getElementById("submit-entry-btn");
    if (submitEntryBtn) submitEntryBtn.addEventListener("click", submitEntry);

    const updateEntryBtn = document.getElementById("update-entry-btn");
    if (updateEntryBtn) updateEntryBtn.addEventListener("click", updateEntry);

    const deleteEntryBtn = document.getElementById("delete-entry-btn");
    if (deleteEntryBtn) deleteEntryBtn.addEventListener("click", confirmDeleteEntry);

    const saveNewBtn = document.getElementById("save-new-btn");
    if (saveNewBtn) saveNewBtn.addEventListener("click", saveAsNewEntry);

    const clearFormBtn = document.getElementById("clear-form-btn");
    if (clearFormBtn) clearFormBtn.addEventListener("click", resetEntryForm);

    const toggleSearchBtn = document.getElementById("toggle-search-btn");
    if (toggleSearchBtn) toggleSearchBtn.addEventListener("click", toggleSearchMode);
}

if (typeof window !== "undefined") {
    window.switchTab = switchTab;
    window.toggleSidebar = toggleSidebar;
    document.addEventListener("DOMContentLoaded", () => {
        mountAllComponents();
        initApp();
    });
}
