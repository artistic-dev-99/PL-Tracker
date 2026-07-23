// Modal Dialogs & Overlays Component
export function renderModalsComponent() {
    return `
    <!-- BULK MODIFY POPUP WINDOW -->
    <div id="bulk-modify-modal" class="modal-overlay hidden">
        <div class="glass-card main-form-card modal-card-large scale-up">
            <div class="modal-header">
                <h2>Bulk Modification Editor</h2>
                <span class="record-counter" id="bulk-index-display">Record 1 of 5</span>
            </div>

            <form id="bulk-form" onsubmit="return false;">
                <div class="form-grid-3">
                    <div class="input-group">
                        <label for="bulk-workorder">Work-Order</label>
                        <input type="text" id="bulk-workorder" maxlength="9">
                        <span class="error-text" id="bulk-workorder-error"></span>
                    </div>

                    <div class="input-group">
                        <label for="bulk-packno">Pack No.</label>
                        <input type="text" id="bulk-packno" maxlength="5">
                        <span class="error-text" id="bulk-packno-error"></span>
                    </div>

                    <div class="input-group">
                        <label for="bulk-pltype">PL Type</label>
                        <select id="bulk-pltype">
                            <option value="New">New</option>
                            <option value="Add">Add</option>
                            <option value="Update">Update</option>
                            <option value="Revise">Revise</option>
                            <option value="R2">R2</option>
                            <option value="Delete">Delete</option>
                        </select>
                        <span class="error-text" id="bulk-pltype-error"></span>
                    </div>
                </div>

                <div class="form-grid-3">
                    <div class="input-group relative-container">
                        <div id="bulk-revise-notification" class="bubble-notification hidden">because of wrong</div>
                        <label for="bulk-subpltype">Sub PL Type</label>
                        <select id="bulk-subpltype">
                            <!-- Populated dynamically -->
                        </select>
                        <span class="error-text" id="bulk-subpltype-error"></span>
                    </div>

                    <div class="input-group">
                        <label for="bulk-location">Location</label>
                        <select id="bulk-location">
                            <option value="B1 GF">B1 GF</option>
                            <option value="B1 FF">B1 FF</option>
                            <option value="B2 GF">B2 GF</option>
                            <option value="B2 FF">B2 FF</option>
                            <option value="B2 HF">B2 HF</option>
                            <option value="B2 EF">B2 EF</option>
                            <option value="KW GF">KW GF</option>
                            <option value="OS">OS</option>
                        </select>
                        <span class="error-text" id="bulk-location-error"></span>
                    </div>

                    <div class="input-group">
                        <label for="bulk-customer">Customer</label>
                        <select id="bulk-customer">
                            <option value="AEO">AEO</option>
                            <option value="Inditex">Inditex</option>
                            <option value="Stacy">Stacy</option>
                            <option value="League">League</option>
                            <option value="VSS">VSS</option>
                        </select>
                        <span class="error-text" id="bulk-customer-error"></span>
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="input-group">
                        <label for="bulk-date">Date (YYYY-MM-DD)</label>
                        <input type="text" id="bulk-date">
                        <span class="error-text" id="bulk-date-error"></span>
                    </div>

                    <div class="input-group">
                        <label for="bulk-time">Time (HH:MM)</label>
                        <div class="time-input-container">
                            <input type="text" id="bulk-time">
                            <span id="bulk-time-helper" class="time-helper-label">Time: -- : --</span>
                        </div>
                        <span class="error-text" id="bulk-time-error"></span>
                    </div>
                </div>

                <div class="bulk-nav-bar">
                    <button type="button" id="bulk-prev-btn" class="nav-arrow-btn">◀ Previous Selected</button>
                    <button type="button" id="bulk-next-btn" class="nav-arrow-btn">Next Selected ▶</button>
                </div>

                <div class="form-actions-row border-top-divider mt-4">
                    <div class="action-buttons-group">
                        <button type="button" id="bulk-save-this-btn" class="info-btn">Save Current Entry changes</button>
                        <button type="button" id="bulk-save-all-btn" class="primary-btn">Save All Selected Changes (1 Click)</button>
                        <button type="button" id="bulk-close-btn" class="secondary-btn">Cancel</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- CONFIRMATION POPUP DIALOG -->
    <div id="confirm-modal" class="modal-overlay hidden">
        <div class="glass-card compact-card modal-card scale-up text-center">
            <span class="warning-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </span>
            <h2>Confirm Action</h2>
            <p id="confirm-msg" class="my-3">Are you sure you want to perform this operation?</p>

            <div class="form-row justify-center mb-4">
                <label class="checkbox-container">
                    <input type="checkbox" id="confirm-dont-show">
                    <span class="checkmark"></span>
                    Don't show this message again
                </label>
            </div>

            <div class="form-actions justify-center">
                <button id="confirm-yes-btn" class="danger-btn px-4">Yes, Delete</button>
                <button id="confirm-no-btn" class="secondary-btn px-4">Cancel</button>
            </div>
        </div>
    </div>

    <!-- ADMIN PASSWORD PROMPT DIALOG -->
    <div id="admin-confirm-modal" class="modal-overlay hidden">
        <div class="glass-card compact-card modal-card scale-up text-center">
            <span class="warning-icon admin-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            </span>
            <h2>Admin Authorization</h2>
            <p class="my-3">Please enter your current Administrator password to confirm this action:</p>
            <div class="input-group mb-4">
                <input type="password" id="admin-confirm-password-input" placeholder="Admin Password" class="w-full">
            </div>
            <div class="form-actions justify-center">
                <button id="admin-confirm-yes-btn" class="primary-btn px-4">Confirm</button>
                <button id="admin-confirm-no-btn" class="secondary-btn px-4">Cancel</button>
            </div>
        </div>
    </div>

    <!-- EXCEL IMPORT SUMMARY MODAL -->
    <div id="excel-import-summary-modal" class="modal-overlay hidden">
        <div class="glass-card modal-card scale-up text-center" style="max-width: 520px; width: 90%;">
            <div class="modal-header justify-center mb-2">
                <h2>Excel Import Successful</h2>
            </div>
            <div class="modal-body text-left mt-2">
                <p id="excel-import-summary-msg" class="subtitle text-md mb-3" style="color: var(--accent-color); font-weight: 600;"></p>
                <div class="details-box p-3 border-rounded glass-panel" style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; font-size: 0.95rem; line-height: 1.6;">
                    <p style="margin: 4px 0;"><strong>Total Entries Imported:</strong> <span id="summary-imported-count" style="color: var(--success-color); font-weight: 700;">0</span></p>
                    <p style="margin: 4px 0;"><strong>Users Processed:</strong> <span id="summary-user-count">0</span></p>
                    <p style="margin: 4px 0;"><strong>New Accounts Auto-Created:</strong> <span id="summary-created-users">None</span></p>
                    <p style="margin: 4px 0;"><strong>Date & Time Range:</strong> <span id="summary-date-range">N/A</span></p>
                </div>
            </div>
            <div class="modal-actions mt-4 justify-center">
                <button type="button" id="btn-close-import-summary" class="primary-btn px-4">Done</button>
            </div>
        </div>
    </div>

    <!-- USER DELETE OPTIONS MODAL -->
    <div id="user-delete-options-modal" class="modal-overlay hidden">
        <div class="glass-card modal-card scale-up text-center" style="max-width: 480px; width: 90%;">
            <div class="modal-header justify-center mb-2">
                <h2 id="delete-user-modal-title">Delete User Account</h2>
            </div>
            <div class="modal-body text-left mt-2">
                <p id="delete-user-modal-msg" class="subtitle text-md mb-3">Are you sure you want to delete this user account?</p>

                <div class="details-box p-3 border-rounded glass-panel mb-3" style="background: rgba(255,255,255,0.03); padding: 14px; border-radius: 8px;">
                    <label style="font-weight: 700; display: block; margin-bottom: 8px;">Packing List Data Handling:</label>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <label class="radio-container" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                            <input type="radio" name="delete-data-option" value="delete" checked>
                            <span><strong>Delete User AND Delete all packing list entries</strong><br><small style="color: var(--label-secondary);">Permanently wipes all entries created by this user.</small></span>
                        </label>
                        <label class="radio-container" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                            <input type="radio" name="delete-data-option" value="keep">
                            <span><strong>Delete User ONLY (Keep packing list entries)</strong><br><small style="color: var(--label-secondary);">Retains historical packing list records in database.</small></span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-actions mt-3 justify-center" style="display: flex; gap: 12px;">
                <button type="button" id="btn-confirm-delete-user" class="danger-btn px-4">Confirm Delete</button>
                <button type="button" id="btn-cancel-delete-user" class="secondary-btn px-4">Cancel</button>
            </div>
        </div>
    </div>
    `;
}
