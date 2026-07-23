// Entry Form & Search Mode Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';
import { confirmDialog } from '../utils/dialogs.js';
import { playUnifiedAudioTone } from '../utils/audio.js';
import { showError, clearError } from './auth.js';

export function formatAndValidateDate(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let val = el.value.replace(/[^0-9]/g, "");

    if (val.length === 8) {
        const y = val.substring(0, 4);
        const m = val.substring(4, 6);
        const d = val.substring(6, 8);
        el.value = `${y}-${m}-${d}`;
    } else if (val.length === 6) {
        const y = "20" + val.substring(0, 2);
        const m = val.substring(2, 4);
        const d = val.substring(4, 6);
        el.value = `${y}-${m}-${d}`;
    }
}

export function formatAndValidateTime(elementId, helperId) {
    const el = document.getElementById(elementId);
    const helper = document.getElementById(helperId);
    if (!el) return;
    let val = el.value.replace(/[^0-9]/g, "");

    if (val.length === 3) {
        val = "0" + val;
    }

    if (val.length === 4) {
        const hh = val.substring(0, 2);
        const mm = val.substring(2, 4);
        el.value = `${hh}:${mm}`;
    }

    const timeMatch = el.value.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (timeMatch && helper) {
        let hour = parseInt(timeMatch[1], 10);
        const min = timeMatch[2];
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const padHour = displayHour < 10 ? "0" + displayHour : displayHour;
        helper.innerText = `Time : ${padHour} : ${min} ${ampm}`;
        helper.classList.remove("text-danger");
    } else if (helper) {
        helper.innerText = "Time: -- : --";
    }
}

export function handlePLTypeChange(plTypeElId, subPlTypeElId, reviseNotifyElId) {
    const plTypeEl = document.getElementById(plTypeElId);
    const subDropdown = document.getElementById(subPlTypeElId);
    const reviseNotification = document.getElementById(reviseNotifyElId);
    if (!plTypeEl || !subDropdown) return;

    const plType = plTypeEl.value;
    subDropdown.innerHTML = '<option value="">Select Sub Type</option>';

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

export function validateEntryForm(isBulk = false) {
    const prefix = isBulk ? "bulk-" : "entry-";
    let valid = true;

    const woEl = document.getElementById(`${prefix}workorder`);
    if (woEl) {
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
    }

    const packEl = document.getElementById(`${prefix}packno`);
    if (packEl) {
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
    }

    const dropdowns = ["pltype", "subpltype", "location", "customer"];
    dropdowns.forEach(field => {
        const el = document.getElementById(`${prefix}${field}`);
        if (el && !el.value) {
            showError(`${prefix}${field}`, "This field is required");
            valid = false;
        } else if (el) {
            clearError(`${prefix}${field}`);
        }
    });

    const dateEl = document.getElementById(`${prefix}date`);
    if (dateEl) {
        const dateVal = dateEl.value.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
            showError(`${prefix}date`, "Invalid date. Format: YYYY-MM-DD");
            valid = false;
        } else {
            clearError(`${prefix}date`);
        }
    }

    const timeEl = document.getElementById(`${prefix}time`);
    if (timeEl) {
        const timeVal = timeEl.value.trim();
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeVal)) {
            showError(`${prefix}time`, "Invalid 24h time. Format: HH:MM");
            valid = false;
        } else {
            clearError(`${prefix}time`);
        }
    }

    return valid;
}

export async function submitEntry() {
    if (!validateEntryForm()) return;

    const submitBtn = document.getElementById("submit-entry-btn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";
    }

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

        const mMaster = document.getElementById("meta-master-id");
        const mUser = document.getElementById("meta-user-id");
        const mDay = document.getElementById("meta-day-id");
        const mDayUser = document.getElementById("meta-day-user-id");
        const mSubmitted = document.getElementById("meta-submitted-by");
        const mPc = document.getElementById("meta-pc-ip");

        if (mMaster) mMaster.innerText = data.entry.master_unique_id;
        if (mUser) mUser.innerText = data.entry.unique_id_by_user;
        if (mDay) mDay.innerText = data.entry.daily_count_id;
        if (mDayUser) mDayUser.innerText = data.entry.unique_id_by_day_by_user;
        if (mSubmitted) mSubmitted.innerText = state.currentUser.username;

        if (window.pywebview && window.pywebview.api && window.pywebview.api.get_local_ip) {
            pywebview.api.get_local_ip().then(ip => {
                if (mPc) mPc.innerText = ip;
            });
        } else if (mPc) {
            mPc.innerText = "127.0.0.1";
        }

        const autoClear = localStorage.getItem("pref_auto_clear") !== "false";
        resetEntryFormFields(autoClear);

        const beepTone = localStorage.getItem("pref_audio_tone") || "chime";
        playUnifiedAudioTone(beepTone);

        toast.success("Entry submitted successfully!");
        const woEl = document.getElementById("entry-workorder");
        if (woEl) woEl.focus();
    } catch (e) {
        toast.error("Submission failed: " + (e.message || "Server unreachable"));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit";
        }
    }
}

export async function updateEntry() {
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
            executeEntrySearch(false);
        } else {
            resetEntryForm();
        }
    } catch (e) {
        toast.error("Failed to update entry: " + (e.message || "Server unreachable"));
    }
}

export function confirmDeleteEntry() {
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

export async function executeDeleteEntry() {
    try {
        await api.delete("/api/entries/delete", {
            requesting_userid: state.currentUser.userid,
            entry_id: state.activeEntryId
        });

        toast.success("Entry deleted successfully!");

        if (state.searchMode) {
            executeEntrySearch(true);
        } else {
            resetEntryForm();
        }
    } catch (e) {
        toast.error("Failed to delete entry: " + (e.message || "Server unreachable"));
    }
}

export async function saveAsNewEntry() {
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

        exitSearchMode();

        document.getElementById("meta-master-id").innerText = data.entry.master_unique_id;
        document.getElementById("meta-user-id").innerText = data.entry.unique_id_by_user;
        document.getElementById("meta-day-id").innerText = data.entry.daily_count_id;
        document.getElementById("meta-day-user-id").innerText = data.entry.unique_id_by_day_by_user;
        document.getElementById("meta-submitted-by").innerText = state.currentUser.username;

        if (window.pywebview && window.pywebview.api && window.pywebview.api.get_local_ip) {
            pywebview.api.get_local_ip().then(ip => {
                document.getElementById("meta-pc-ip").innerText = ip;
            });
        } else {
            document.getElementById("meta-pc-ip").innerText = "127.0.0.1";
        }

        resetEntryFormFields(false);
        const woEl = document.getElementById("entry-workorder");
        if (woEl) woEl.focus();
    } catch (e) {
        toast.error("Failed to save as new entry: " + (e.message || "Server unreachable"));
    }
}

export function resetEntryForm() {
    resetEntryFormFields(true);
    state.activeEntryId = null;

    const mMaster = document.getElementById("meta-master-id");
    const mUser = document.getElementById("meta-user-id");
    const mDay = document.getElementById("meta-day-id");
    const mDayUser = document.getElementById("meta-day-user-id");
    const mPc = document.getElementById("meta-pc-ip");
    const mSub = document.getElementById("meta-submitted-by");

    if (mMaster) mMaster.innerText = "—";
    if (mUser) mUser.innerText = "—";
    if (mDay) mDay.innerText = "—";
    if (mDayUser) mDayUser.innerText = "—";
    if (mPc) mPc.innerText = "—";
    if (mSub) mSub.innerText = "—";

    const submitBtn = document.getElementById("submit-entry-btn");
    const updateBtn = document.getElementById("update-entry-btn");
    const deleteBtn = document.getElementById("delete-entry-btn");
    const saveNewBtn = document.getElementById("save-new-btn");

    if (submitBtn) submitBtn.classList.remove("hidden");
    if (updateBtn) updateBtn.classList.add("hidden");
    if (deleteBtn) deleteBtn.classList.add("hidden");
    if (saveNewBtn) saveNewBtn.classList.add("hidden");

    exitSearchMode();
}

export function resetEntryFormFields(clearAll = false) {
    const woEl = document.getElementById("entry-workorder");
    const packEl = document.getElementById("entry-packno");
    if (woEl) woEl.value = "";
    if (packEl) packEl.value = "";

    document.querySelectorAll(".error-text").forEach(el => el.innerText = "");

    if (clearAll) {
        const defLoc = localStorage.getItem("pref_default_location") || "";
        const defCust = localStorage.getItem("pref_default_customer") || "";
        const defPLType = localStorage.getItem("pref_default_pltype") || "";

        const locEl = document.getElementById("entry-location");
        const custEl = document.getElementById("entry-customer");
        const plEl = document.getElementById("entry-pltype");

        if (locEl) locEl.value = defLoc;
        if (custEl) custEl.value = defCust;
        if (plEl) plEl.value = defPLType;
        handlePLTypeChange("entry-pltype", "entry-subpltype", "revise-notification");

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateEl = document.getElementById("entry-date");
        if (dateEl) dateEl.value = `${yyyy}-${mm}-${dd}`;

        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const timeEl = document.getElementById("entry-time");
        if (timeEl) timeEl.value = `${hh}:${min}`;
        formatAndValidateTime("entry-time", "time-helper");
    }
}

export function toggleSearchMode() {
    if (state.searchMode) {
        exitSearchMode();
    } else {
        enterSearchMode();
    }
}

export function enterSearchMode() {
    state.searchMode = true;

    const badge = document.getElementById("search-mode-badge");
    const searchBtn = document.getElementById("toggle-search-btn");
    const titleEl = document.getElementById("form-title");
    const navControls = document.getElementById("search-nav-controls");
    const submitBtn = document.getElementById("submit-entry-btn");
    const updateBtn = document.getElementById("update-entry-btn");
    const deleteBtn = document.getElementById("delete-entry-btn");
    const saveNewBtn = document.getElementById("save-new-btn");

    if (badge) badge.classList.remove("hidden");
    if (searchBtn) { searchBtn.innerText = "Exit Search"; searchBtn.className = "dark-btn"; }
    if (titleEl) titleEl.innerText = "Search Packing List Records";
    if (navControls) navControls.classList.remove("hidden");

    if (submitBtn) submitBtn.classList.add("hidden");
    if (updateBtn) updateBtn.classList.remove("hidden");
    if (deleteBtn) deleteBtn.classList.remove("hidden");
    if (saveNewBtn) saveNewBtn.classList.remove("hidden");

    resetEntryFormFields(true);
    const dateEl = document.getElementById("entry-date");
    const timeEl = document.getElementById("entry-time");
    const helperEl = document.getElementById("time-helper");
    if (dateEl) dateEl.value = "";
    if (timeEl) timeEl.value = "";
    if (helperEl) helperEl.innerText = "Time: -- : --";

    executeEntrySearch();
}

export function exitSearchMode() {
    state.searchMode = false;

    const badge = document.getElementById("search-mode-badge");
    const searchBtn = document.getElementById("toggle-search-btn");
    const titleEl = document.getElementById("form-title");
    const navControls = document.getElementById("search-nav-controls");
    const submitBtn = document.getElementById("submit-entry-btn");
    const updateBtn = document.getElementById("update-entry-btn");
    const deleteBtn = document.getElementById("delete-entry-btn");
    const saveNewBtn = document.getElementById("save-new-btn");

    if (badge) badge.classList.add("hidden");
    if (searchBtn) { searchBtn.innerText = "Search Mode"; searchBtn.className = "search-btn"; }
    if (titleEl) titleEl.innerText = "New Packing List Entry";
    if (navControls) navControls.classList.add("hidden");

    if (submitBtn) submitBtn.classList.remove("hidden");
    if (updateBtn) updateBtn.classList.add("hidden");
    if (deleteBtn) deleteBtn.classList.add("hidden");
    if (saveNewBtn) saveNewBtn.classList.add("hidden");

    state.searchResults = [];
    state.searchIndex = -1;
    state.activeEntryId = null;

    resetEntryFormFields(true);
}

export async function executeEntrySearch(deleteOffset = false) {
    const params = new URLSearchParams();

    const wo = document.getElementById("entry-workorder")?.value.trim() || "";
    const pack = document.getElementById("entry-packno")?.value.trim() || "";
    const pl = document.getElementById("entry-pltype")?.value || "";
    const sub = document.getElementById("entry-subpltype")?.value || "";
    const loc = document.getElementById("entry-location")?.value || "";
    const cust = document.getElementById("entry-customer")?.value || "";
    const date = document.getElementById("entry-date")?.value.trim() || "";

    if (wo) params.append("work_order", wo);
    if (pack) params.append("pack_no", pack);
    if (pl) params.append("pl_type", pl);
    if (sub) params.append("sub_pl_type", sub);
    if (loc) params.append("location", loc);
    if (cust) params.append("customer", cust);
    if (date) params.append("start_date", date);

    try {
        const data = await api.get(`/api/entries/query?${params.toString()}`);
        state.searchResults = data;

        if (state.searchResults.length > 0) {
            if (deleteOffset && state.searchIndex >= state.searchResults.length) {
                state.searchIndex = state.searchResults.length - 1;
            } else if (!deleteOffset) {
                state.searchIndex = 0;
            }
            displaySearchResultAtActiveIndex();
        } else {
            state.searchIndex = -1;
            state.activeEntryId = null;
            const indexDisplay = document.getElementById("search-index-display");
            if (indexDisplay) indexDisplay.innerText = "No Records Found";
            resetEntryFormFields(false);
        }
    } catch (e) {
        toast.error("Search failed: " + (e.message || "Server unreachable"));
    }
}

export function displaySearchResultAtActiveIndex() {
    if (state.searchIndex < 0 || state.searchIndex >= state.searchResults.length) return;

    const entry = state.searchResults[state.searchIndex];
    state.activeEntryId = entry.EntryID;

    const woEl = document.getElementById("entry-workorder");
    const packEl = document.getElementById("entry-packno");
    const plEl = document.getElementById("entry-pltype");
    const subEl = document.getElementById("entry-subpltype");
    const locEl = document.getElementById("entry-location");
    const custEl = document.getElementById("entry-customer");
    const dateEl = document.getElementById("entry-date");
    const timeEl = document.getElementById("entry-time");

    if (woEl) woEl.value = entry.WorkOrder;
    if (packEl) packEl.value = entry.PackNo;
    if (plEl) {
        plEl.value = entry.PLType;
        handlePLTypeChange("entry-pltype", "entry-subpltype", "revise-notification");
    }
    if (subEl) subEl.value = entry.SubPLType;
    if (locEl) locEl.value = entry.Location;
    if (custEl) custEl.value = entry.Customer;

    const parts = (entry.EntryTimestamp || "").split(" ");
    if (dateEl && parts[0]) dateEl.value = parts[0];
    if (timeEl && parts[1]) {
        timeEl.value = parts[1].substring(0, 5);
        formatAndValidateTime("entry-time", "time-helper");
    }

    const mMaster = document.getElementById("meta-master-id");
    const mUser = document.getElementById("meta-user-id");
    const mDay = document.getElementById("meta-day-id");
    const mDayUser = document.getElementById("meta-day-user-id");
    const mPc = document.getElementById("meta-pc-ip");
    const mSub = document.getElementById("meta-submitted-by");

    if (mMaster) mMaster.innerText = entry.MasterUniqueID || "—";
    if (mUser) mUser.innerText = entry.UniqueIDByUser || "—";
    if (mDay) mDay.innerText = entry.DailyCountID || "—";
    if (mDayUser) mDayUser.innerText = entry.UniqueIDByDayByUser || "—";
    if (mPc) mPc.innerText = entry.SourcePC_IP || "—";
    if (mSub) mSub.innerText = entry.Username || "—";

    const indexDisplay = document.getElementById("search-index-display");
    if (indexDisplay) {
        indexDisplay.innerText = `Record ${state.searchIndex + 1} of ${state.searchResults.length}`;
    }
}

export function cycleSearchRecord(direction) {
    if (!state.searchMode || state.searchResults.length === 0) return;

    if (direction === "next") {
        state.searchIndex = (state.searchIndex + 1) % state.searchResults.length;
    } else {
        state.searchIndex = (state.searchIndex - 1 + state.searchResults.length) % state.searchResults.length;
    }
    displaySearchResultAtActiveIndex();
}

if (typeof window !== "undefined") {
    window.formatAndValidateDate = formatAndValidateDate;
    window.formatAndValidateTime = formatAndValidateTime;
    window.handlePLTypeChange = handlePLTypeChange;
    window.validateEntryForm = validateEntryForm;
    window.submitEntry = submitEntry;
    window.updateEntry = updateEntry;
    window.confirmDeleteEntry = confirmDeleteEntry;
    window.executeDeleteEntry = executeDeleteEntry;
    window.saveAsNewEntry = saveAsNewEntry;
    window.resetEntryForm = resetEntryForm;
    window.resetEntryFormFields = resetEntryFormFields;
    window.toggleSearchMode = toggleSearchMode;
    window.enterSearchMode = enterSearchMode;
    window.exitSearchMode = exitSearchMode;
    window.executeEntrySearch = executeEntrySearch;
    window.cycleSearchRecord = cycleSearchRecord;
}
