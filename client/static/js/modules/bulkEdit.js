// Bulk Edit & Batch Modification Workspace Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';
import { confirmDialog } from '../utils/dialogs.js';
import { handlePLTypeChange, validateEntryForm, formatAndValidateTime } from './entryForm.js';
import { fetchSpreadsheetData } from './spreadsheet.js';

export function triggerBulkModify() {
    if (state.selectedEntryIds.size === 0) {
        toast.warning("Please select at least one packing list row to edit.");
        return;
    }

    const selectedIds = Array.from(state.selectedEntryIds);
    state.bulkEntries = state.sheetEntries
        .filter(e => selectedIds.includes(e.EntryID))
        .sort((a, b) => new Date(a.EntryTimestamp) - new Date(b.EntryTimestamp));

    state.bulkIndex = 0;
    state.bulkModifiedData = {};

    const modal = document.getElementById("bulk-modify-modal");
    if (modal) modal.classList.remove("hidden");
    displayBulkEntryAtActiveIndex();
}

export function displayBulkEntryAtActiveIndex() {
    if (state.bulkIndex < 0 || state.bulkIndex >= state.bulkEntries.length) return;

    const entry = state.bulkEntries[state.bulkIndex];
    const originalId = entry.EntryID;

    const data = state.bulkModifiedData[originalId] || {
        work_order: entry.WorkOrder,
        pack_no: entry.PackNo,
        pl_type: entry.PLType,
        sub_pl_type: entry.SubPLType,
        location: entry.Location,
        customer: entry.Customer,
        timestamp: entry.EntryTimestamp
    };

    const woEl = document.getElementById("bulk-workorder");
    const packEl = document.getElementById("bulk-packno");
    const plEl = document.getElementById("bulk-pltype");
    const subEl = document.getElementById("bulk-subpltype");
    const locEl = document.getElementById("bulk-location");
    const custEl = document.getElementById("bulk-customer");

    if (woEl) woEl.value = data.work_order;
    if (packEl) packEl.value = data.pack_no;
    if (plEl) {
        plEl.value = data.pl_type;
        handlePLTypeChange("bulk-pltype", "bulk-subpltype", "bulk-revise-notification");
    }
    if (subEl) subEl.value = data.sub_pl_type;
    if (locEl) locEl.value = data.location;
    if (custEl) custEl.value = data.customer;

    const parts = (data.timestamp || "").split(" ");
    const dateEl = document.getElementById("bulk-date");
    const timeEl = document.getElementById("bulk-time");

    if (dateEl && parts[0]) dateEl.value = parts[0];
    if (timeEl && parts[1]) {
        timeEl.value = parts[1].substring(0, 5);
        formatAndValidateTime("bulk-time", "bulk-time-helper");
    }

    document.querySelectorAll("#bulk-modify-modal .error-text").forEach(el => el.innerText = "");

    const indexDisplay = document.getElementById("bulk-index-display");
    if (indexDisplay) {
        indexDisplay.innerText = `Record ${state.bulkIndex + 1} of ${state.bulkEntries.length}`;
    }
}

export function saveActiveBulkChangesLocally() {
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

export function cycleBulkRecord(direction) {
    if (!saveActiveBulkChangesLocally()) return;

    if (direction === "next") {
        state.bulkIndex = (state.bulkIndex + 1) % state.bulkEntries.length;
    } else {
        state.bulkIndex = (state.bulkIndex - 1 + state.bulkEntries.length) % state.bulkEntries.length;
    }
    displayBulkEntryAtActiveIndex();
}

export async function commitBulkAllChanges() {
    if (!saveActiveBulkChangesLocally()) return;

    const updatesList = [];
    state.bulkEntries.forEach(entry => {
        const eid = entry.EntryID;
        const modified = state.bulkModifiedData[eid];
        if (modified) {
            updatesList.push(modified);
        }
    });

    if (updatesList.length === 0) {
        const modal = document.getElementById("bulk-modify-modal");
        if (modal) modal.classList.add("hidden");
        return;
    }

    const payload = {
        requesting_userid: state.currentUser.userid,
        updates: updatesList
    };

    try {
        await api.post("/api/entries/bulk-update", payload);
        toast.success(`Successfully updated ${updatesList.length} records!`);
        const modal = document.getElementById("bulk-modify-modal");
        if (modal) modal.classList.add("hidden");
        fetchSpreadsheetData();
    } catch (e) {
        toast.error("Bulk update failed: " + (e.message || "Server unreachable"));
    }
}

export async function triggerBulkDelete() {
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

if (typeof window !== "undefined") {
    window.triggerBulkModify = triggerBulkModify;
    window.displayBulkEntryAtActiveIndex = displayBulkEntryAtActiveIndex;
    window.saveActiveBulkChangesLocally = saveActiveBulkChangesLocally;
    window.cycleBulkRecord = cycleBulkRecord;
    window.commitBulkAllChanges = commitBulkAllChanges;
    window.triggerBulkDelete = triggerBulkDelete;
}
