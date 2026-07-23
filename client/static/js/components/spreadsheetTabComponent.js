// Previous Entries Spreadsheet Component
export function renderSpreadsheetTabComponent() {
    return `
    <section id="previous-entries-tab" class="tab-content hidden">
        <div class="spreadsheet-container glass-card">
            <div class="table-toolbar">
                <div class="toolbar-left">
                    <button id="bulk-modify-dropdown-btn" class="dropdown-trigger-btn">Modify / Delete Selected ▾</button>
                    <div id="bulk-dropdown-menu" class="dropdown-menu hidden">
                        <button id="bulk-edit-btn">Bulk Modify Selected</button>
                        <button id="bulk-delete-btn" class="menu-danger-btn">Delete Selected</button>
                    </div>
                    <span class="selection-status-label" id="selection-status">0 rows selected</span>
                </div>

                <div class="quick-filter-swatches">
                    <span class="swatch-label">Quick:</span>
                    <button class="swatch-btn active" data-range="all">All</button>
                    <button class="swatch-btn" data-range="hour">1 Hour</button>
                    <button class="swatch-btn" data-range="today">Today</button>
                    <button class="swatch-btn" data-range="yesterday">Yesterday</button>
                    <button class="swatch-btn" data-range="week">This Week</button>
                    <button class="swatch-btn" data-range="month">This Month</button>
                </div>
            </div>

            <div class="filter-search-row">
                <div class="input-inline">
                    <input type="text" id="sheet-search" placeholder="Search by WO, Pack, Customer, Location...">
                </div>
                <div class="input-inline">
                    <label>From:</label>
                    <input type="date" id="sheet-start-date">
                </div>
                <div class="input-inline">
                    <label>To:</label>
                    <input type="date" id="sheet-end-date">
                </div>
                <button id="sheet-filter-btn" class="primary-btn compact-btn">Apply</button>
                <button id="sheet-clear-btn" class="secondary-btn compact-btn">Reset</button>
            </div>

            <div class="table-wrapper">
                <table id="entries-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="MasterUniqueID">Master ID</th>
                            <th class="sortable" data-sort="UniqueIDByUser">User ID</th>
                            <th class="sortable" data-sort="DailyCountID">Daily ID</th>
                            <th class="sortable" data-sort="UniqueIDByDayByUser">User Daily</th>
                            <th class="sortable" data-sort="WorkOrder">Work Order</th>
                            <th class="sortable" data-sort="PackNo">Pack No</th>
                            <th class="sortable" data-sort="PLType">PL Type</th>
                            <th class="sortable" data-sort="SubPLType">Sub PL Type</th>
                            <th class="sortable" data-sort="Location">Location</th>
                            <th class="sortable" data-sort="Customer">Customer</th>
                            <th class="sortable" data-sort="EntryTimestamp">Timestamp</th>
                            <th class="sortable" data-sort="Username">Operator</th>
                            <th class="sortable" data-sort="SourcePC_IP">Source IP</th>
                            <th class="text-center width-50"><input type="checkbox" id="select-all-entries"></th>
                        </tr>
                    </thead>
                    <tbody id="entries-table-body">
                        <!-- Populated dynamically -->
                    </tbody>
                </table>
            </div>

            <div id="spreadsheet-pagination" class="pagination-controls hidden">
                <button id="prev-page-btn" class="secondary-btn compact-btn">◀ Previous</button>
                <span id="page-info" class="page-info-text">Page 1 of 1</span>
                <button id="next-page-btn" class="secondary-btn compact-btn">Next ▶</button>
            </div>
        </div>
    </section>
    `;
}
