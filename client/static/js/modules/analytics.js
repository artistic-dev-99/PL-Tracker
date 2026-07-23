// Analytics Dashboard & Chart.js Visualizations Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/domUtils.js';

export const userDashState = {
    allEntries: [],
    selectedUser: "all",
    datePreset: "all",
    startDate: "",
    endDate: "",
    activeViewMode: "trend",
    selectedBreakdownCategory: "pl_type",
    chartInstance: null,
    isInitialized: false
};

export function initUserDashboardEventListeners() {
    if (userDashState.isInitialized) return;
    userDashState.isInitialized = true;

    const userSelect = document.getElementById("dash-user-filter");
    if (userSelect) {
        userSelect.addEventListener("change", (e) => {
            userDashState.selectedUser = e.target.value;
            updateUserDashboardView();
        });
    }

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

    const viewModeContainer = document.getElementById("user-view-mode-toggle");
    if (viewModeContainer) {
        const toggleBtns = viewModeContainer.querySelectorAll(".toggle-btn");
        toggleBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                toggleBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const mode = btn.getAttribute("data-view-mode");
                userDashState.activeViewMode = mode;

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

    const catSelect = document.getElementById("user-breakdown-category");
    if (catSelect) {
        catSelect.addEventListener("change", (e) => {
            userDashState.selectedBreakdownCategory = e.target.value;
            const filteredEntries = getFilteredUserEntries();
            renderUserUnifiedVisualization(filteredEntries);
        });
    }

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

export async function refreshDashboardAnalytics() {
    initUserDashboardEventListeners();
    try {
        const allEntries = await api.get("/api/entries/query");
        userDashState.allEntries = Array.isArray(allEntries) ? allEntries : (allEntries.entries || []);
        populateUserFilterDropdown(userDashState.allEntries);
        updateUserDashboardView();
    } catch (e) {
        console.error("Dashboard data load error:", e);
    }
}

export function populateUserFilterDropdown(entries) {
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

export function getFilteredUserEntries() {
    const { allEntries, selectedUser, datePreset, startDate, endDate } = userDashState;
    const now = new Date();

    return allEntries.filter(e => {
        if (selectedUser !== "all") {
            if (e.Username !== selectedUser && String(e.UserID) !== String(selectedUser)) {
                return false;
            }
        }

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

export function updateUserDashboardView() {
    const filteredEntries = getFilteredUserEntries();
    renderUserUnifiedVisualization(filteredEntries);
}

export function getThemeChartPalette() {
    const style = getComputedStyle(document.body);
    const accent = style.getPropertyValue('--accent').trim() || '#FF4500';
    const textPrimary = style.getPropertyValue('--label-primary').trim() || '#f0f0f0';
    const textSecondary = style.getPropertyValue('--label-secondary').trim() || '#86868b';
    const separator = style.getPropertyValue('--separator').trim() || 'rgba(255, 255, 255, 0.1)';

    return { accent, textPrimary, textSecondary, separator };
}

export function getEntryCategoryKey(entry, category) {
    if (category === "pl_type") return entry.PLType || "Unspecified";
    if (category === "sub_pl_type") return entry.SubPLType || "Unspecified";
    if (category === "location") return entry.Location || "Unspecified";
    if (category === "customer") return entry.Customer || "Unspecified";
    return "Total Volume";
}

export function renderUserUnifiedVisualization(entries) {
    const canvasEl = document.getElementById("user-unified-chart");
    if (!canvasEl) return;

    if (!window.Chart || !entries || entries.length === 0) {
        if (userDashState.chartInstance) {
            userDashState.chartInstance.destroy();
            userDashState.chartInstance = null;
        }
        return;
    }

    if (userDashState.chartInstance) {
        userDashState.chartInstance.destroy();
        userDashState.chartInstance = null;
    }

    const theme = getThemeChartPalette();
    const ctx = canvasEl.getContext("2d");
    const category = userDashState.selectedBreakdownCategory;

    const breakdownMap = {};
    entries.forEach(e => {
        const key = getEntryCategoryKey(e, category);
        breakdownMap[key] = (breakdownMap[key] || 0) + 1;
    });

    const keys = Object.keys(breakdownMap).sort((a, b) => breakdownMap[b] - breakdownMap[a]);
    const values = keys.map(k => breakdownMap[k]);

    userDashState.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: keys,
            datasets: [{
                label: 'Volume',
                data: values,
                backgroundColor: theme.accent,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: theme.textSecondary } },
                y: { beginAtZero: true, ticks: { color: theme.textSecondary } }
            }
        }
    });
}

if (typeof window !== "undefined") {
    window.refreshDashboardAnalytics = refreshDashboardAnalytics;
    window.updateUserDashboardView = updateUserDashboardView;
}
