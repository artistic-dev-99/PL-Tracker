// Excel Data Import Module
import { state } from '../state.js';
import { api } from '../api.js';
import { toast } from '../utils/toast.js';
import { fetchSpreadsheetData } from './spreadsheet.js';
import { refreshDashboardAnalytics } from './analytics.js';
import { fetchAdminUsersList } from './userManagement.js';

export function setupExcelImportUI() {
    const fileInput1 = document.getElementById("excel-import-file");
    const submitBtn1 = document.getElementById("btn-submit-excel-import");
    const statusMsg1 = document.getElementById("excel-import-status");

    const fileInputMain = document.getElementById("excel-import-file-main");
    const submitBtnMain = document.getElementById("btn-submit-excel-import-main");
    const statusMsgMain = document.getElementById("excel-import-status-main");

    const menuBtn = document.getElementById("menu-action-import-excel");
    const summaryModal = document.getElementById("excel-import-summary-modal");
    const closeSummaryBtn = document.getElementById("btn-close-import-summary");

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
            if (window.switchTab) window.switchTab("settings-tab");
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
}

export async function handleExcelDataImport(fileInputParam, submitBtnParam, statusMsgParam) {
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
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Importing...";
    }
    if (statusMsg) {
        statusMsg.className = "status-msg text-sm mt-2";
        statusMsg.innerText = "Uploading & processing Excel file... Please wait.";
    }

    try {
        const formData = new FormData();
        formData.append("userid", state.currentUser.userid);
        formData.append("file", file);

        const data = await api.post("/api/admin/import-excel", formData);

        if (statusMsg) {
            statusMsg.className = "status-msg success-msg text-sm mt-2";
            statusMsg.innerText = "Excel import completed successfully!";
        }

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

        fileInput.value = "";
        if (submitBtn) submitBtn.style.display = "none";

        toast.success(`Imported ${data.imported_count} packing list entries!`);
        fetchSpreadsheetData();
        refreshDashboardAnalytics();
        fetchAdminUsersList();
    } catch (e) {
        if (statusMsg) {
            statusMsg.className = "status-msg error-msg text-sm mt-2";
            statusMsg.innerText = e.message || "Failed to import Excel file.";
        }
        toast.error(e.message || "Import failed");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "Upload & Import Data";
        }
    }
}

if (typeof window !== "undefined") {
    window.setupExcelImportUI = setupExcelImportUI;
    window.handleExcelDataImport = handleExcelDataImport;
}
