// Entry Form Workspace Tab Component
export function renderEntryFormTabComponent() {
    return `
    <section id="entry-form-tab" class="tab-content">
        <div class="entry-layout">
            <div class="glass-card main-form-card">
                <div class="form-header">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <h2 id="form-title">New Packing List Entry</h2>
                        <div id="search-mode-badge" class="badge search-badge hidden">SEARCH MODE ACTIVE (F11)</div>
                    </div>
                </div>

                <form id="entry-form" onsubmit="return false;">
                    <div class="form-grid-3">
                        <div class="input-group">
                            <label for="entry-workorder">Work-Order</label>
                            <input type="text" id="entry-workorder" maxlength="9">
                            <span class="error-text" id="entry-workorder-error"></span>
                        </div>

                        <div class="input-group">
                            <label for="entry-packno">Pack No.</label>
                            <input type="text" id="entry-packno" maxlength="5">
                            <span class="error-text" id="entry-packno-error"></span>
                        </div>

                        <div class="input-group">
                            <label for="entry-pltype">PL Type</label>
                            <select id="entry-pltype">
                                <option value="">Select PL Type</option>
                                <option value="New">New</option>
                                <option value="Add">Add</option>
                                <option value="Update">Update</option>
                                <option value="Revise">Revise</option>
                                <option value="R2">R2</option>
                                <option value="Delete">Delete</option>
                            </select>
                            <span class="error-text" id="entry-pltype-error"></span>
                        </div>
                    </div>

                    <div class="form-grid-3">
                        <div class="input-group relative-container">
                            <div id="revise-notification" class="bubble-notification hidden">because of wrong</div>
                            <label for="entry-subpltype">Sub PL Type</label>
                            <select id="entry-subpltype">
                                <option value="">Select Sub Type</option>
                            </select>
                            <span class="error-text" id="entry-subpltype-error"></span>
                        </div>

                        <div class="input-group">
                            <label for="entry-location">Location</label>
                            <select id="entry-location">
                                <option value="">Select Location</option>
                                <option value="B1 GF">B1 GF</option>
                                <option value="B1 FF">B1 FF</option>
                                <option value="B2 GF">B2 GF</option>
                                <option value="B2 FF">B2 FF</option>
                                <option value="B2 HF">B2 HF</option>
                                <option value="B2 EF">B2 EF</option>
                                <option value="KW GF">KW GF</option>
                                <option value="OS">OS</option>
                            </select>
                            <span class="error-text" id="entry-location-error"></span>
                        </div>

                        <div class="input-group">
                            <label for="entry-customer">Customer</label>
                            <select id="entry-customer">
                                <option value="">Select Customer</option>
                                <option value="AEO">AEO</option>
                                <option value="Inditex">Inditex</option>
                                <option value="Stacy">Stacy</option>
                                <option value="League">League</option>
                                <option value="VSS">VSS</option>
                            </select>
                            <span class="error-text" id="entry-customer-error"></span>
                        </div>
                    </div>

                    <div class="input-group mb-3">
                        <label>PL Mode</label>
                        <div class="mode-checkbox-group"
                            style="display: flex; gap: 24px; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--sidebar-border); margin-top: 4px;">
                            <label class="checkbox-container"
                                style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                                <input type="checkbox" id="mode-mail" name="pl-mode" value="Mail">
                                <span class="checkmark"></span>
                                <span style="font-weight: 600; font-size: 0.95rem;">Mail</span>
                            </label>
                            <label class="checkbox-container"
                                style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                                <input type="checkbox" id="mode-manual" name="pl-mode" value="Manual" checked>
                                <span class="checkmark"></span>
                                <span style="font-weight: 600; font-size: 0.95rem;">Manual</span>
                            </label>
                        </div>
                        <span class="error-text" id="entry-mode-error"></span>
                    </div>

                    <div class="form-grid-2">
                        <div class="input-group">
                            <label for="entry-date">Date (YYYY-MM-DD)</label>
                            <input type="text" id="entry-date">
                            <span class="error-text" id="entry-date-error"></span>
                        </div>

                        <div class="input-group">
                            <label for="entry-time">Time (HH:MM)</label>
                            <div class="time-input-container">
                                <input type="text" id="entry-time">
                                <span id="time-helper" class="time-helper-label">Time: -- : --</span>
                            </div>
                            <span class="error-text" id="entry-time-error"></span>
                        </div>
                    </div>

                    <div class="form-actions-row">
                        <div class="action-buttons-group">
                            <button type="button" id="submit-entry-btn" class="primary-btn" title="Ctrl+Enter">Submit</button>
                            <button type="button" id="update-entry-btn" class="info-btn hidden" title="Ctrl+Enter">Update</button>
                            <button type="button" id="delete-entry-btn" class="danger-btn hidden" title="Ctrl+Delete">Delete</button>
                            <button type="button" id="save-new-btn" class="secondary-btn hidden" title="Ctrl+Shift+Enter">Save as New</button>
                            <button type="button" id="clear-form-btn" class="dark-btn" title="Delete">Clear</button>
                            <button type="button" id="toggle-search-btn" class="search-btn" title="F11">Search Mode</button>
                        </div>
                    </div>

                    <div id="search-nav-controls" class="search-nav-bar hidden">
                        <button type="button" id="prev-record-btn" class="nav-arrow-btn">◀ Previous Record</button>
                        <span id="search-index-display" class="record-counter">Record 0 of 0</span>
                        <button type="button" id="next-record-btn" class="nav-arrow-btn">Next Record ▶</button>
                    </div>
                </form>
            </div>

            <div class="glass-card meta-display-card">
                <h3>Tracking & Metadata</h3>
                <p class="meta-desc">These values are generated securely by the Server upon write.</p>

                <div class="meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">Master Unique ID</span>
                        <span id="meta-master-id" class="meta-val">—</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Unique ID by User</span>
                        <span id="meta-user-id" class="meta-val">—</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Master Unique ID by Day</span>
                        <span id="meta-day-id" class="meta-val">—</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Unique ID by Day by User</span>
                        <span id="meta-day-user-id" class="meta-val">—</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">PC IP Address</span>
                        <span id="meta-pc-ip" class="meta-val">—</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Submitted By</span>
                        <span id="meta-submitted-by" class="meta-val">—</span>
                    </div>
                </div>
            </div>

            <div class="glass-card live-activity-card mt-3">
                <div class="card-header-row">
                    <h3>Office Live Activity Feed</h3>
                    <span class="live-indicator"><span class="pulse-dot"></span>LIVE</span>
                </div>
                <div class="activity-feed-container" id="live-activity-feed">
                    <p class="no-activity">No active scans logged yet.</p>
                </div>
            </div>
        </div>
    </section>
    `;
}
