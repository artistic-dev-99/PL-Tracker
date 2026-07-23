// Spreadsheet / Previous Entries Data Grid Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';

export async function fetchSpreadsheetData() {
    const params = new URLSearchParams();
    const now = new Date();
    let startDate = "";
    let endDate = now.toISOString().substring(0, 10);

    if (state.quickFilter === "hour") {
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

    const customStart = document.getElementById("sheet-start-date")?.value || "";
    const customEnd = document.getElementById("sheet-end-date")?.value || "";
    if (customStart) startDate = customStart;
    if (customEnd) endDate = customEnd;

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const searchVal = document.getElementById("sheet-search")?.value.trim() || "";
    if (searchVal) params.append("search_query", searchVal);

    try {
        state.sheetEntries = await api.get(`/api/entries/query?${params.toString()}`);
        state.selectedEntryIds.clear();
        const selectAllCb = document.getElementById("select-all-entries");
        if (selectAllCb) selectAllCb.checked = false;
        updateSelectionStatusLabel();
        renderSpreadsheet();
    } catch (e) {
        toast.error("Failed to load spreadsheet: " + (e.message || "Server unreachable"));
    }
}

export function renderSpreadsheet() {
    const tbody = document.getElementById("entries-table-body");
    if (!tbody) return;
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
        if (pageInfo) pageInfo.innerText = `Page ${state.currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = state.currentPage === 1;
        if (nextBtn) nextBtn.disabled = state.currentPage === totalPages;
    }

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const paginatedEntries = state.sheetEntries.slice(startIdx, startIdx + state.pageSize);

    paginatedEntries.forEach(entry => {
        const tr = document.createElement("tr");
        const parts = (entry.EntryTimestamp || "").split(" ");
        const timeStr = parts[1] ? parts[1].substring(0, 5) : "";

        const isOwner = state.currentUser && entry.UserID === state.currentUser.userid;
        const isAdmin = state.currentUser && state.currentUser.role === "Admin";
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

        const cb = tr.querySelector(".entry-row-checkbox");
        if (canModify && cb) {
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

export function updateSelectionStatusLabel() {
    const count = state.selectedEntryIds.size;
    const label = document.getElementById("selection-status");
    if (label) label.innerText = `${count} rows selected`;
}

export function toggleSelectAllEntries(checked) {
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

export function handleSpreadsheetSort(columnName) {
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
    state.currentPage = 1;
    renderSpreadsheet();
}

export function updateSortHeadersUI() {
    const headers = document.querySelectorAll("#entries-table th.sortable");
    headers.forEach(th => {
        th.classList.remove("asc", "desc");
        const col = th.getAttribute("data-sort");
        if (col === state.sortColumn) {
            th.classList.add(state.sortDirection);
        }
    });
}

if (typeof window !== "undefined") {
    window.fetchSpreadsheetData = fetchSpreadsheetData;
    window.renderSpreadsheet = renderSpreadsheet;
    window.updateSelectionStatusLabel = updateSelectionStatusLabel;
    window.toggleSelectAllEntries = toggleSelectAllEntries;
    window.handleSpreadsheetSort = handleSpreadsheetSort;
}
