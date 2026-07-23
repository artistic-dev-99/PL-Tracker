// Sidebar Navigation Component
export function renderSidebarComponent() {
    return `
    <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-top">
            <button type="button" id="sidebar-collapse-btn" class="sidebar-toggle-btn" title="Toggle Sidebar (Ctrl+B)"
                aria-label="Toggle Sidebar">
                <svg class="toggle-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>
        </div>

        <nav class="sidebar-navigation">
            <button class="tab-btn active" data-tab="entry-form-tab" title="Entry Form (Ctrl+1)">
                <span class="tab-icon">
                    <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                </span>
                <span class="tab-text">Entry Form</span>
            </button>
            <button class="tab-btn" data-tab="previous-entries-tab" title="Previous Entries (Ctrl+2)">
                <span class="tab-icon">
                    <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                </span>
                <span class="tab-text">Previous Entries</span>
            </button>
            <button class="tab-btn" data-tab="dashboard-tab" title="Dashboard Analytics (Ctrl+3)">
                <span class="tab-icon">
                    <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="9" />
                        <rect x="14" y="3" width="7" height="5" />
                        <rect x="14" y="12" width="7" height="9" />
                        <rect x="3" y="16" width="7" height="5" />
                    </svg>
                </span>
                <span class="tab-text">Dashboard</span>
            </button>
            <button class="tab-btn" data-tab="report-tab" title="Report Generator (Ctrl+4)">
                <span class="tab-icon">
                    <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                </span>
                <span class="tab-text">Report Generator</span>
            </button>
            <button class="tab-btn" data-tab="settings-tab" title="Settings (Ctrl+5)">
                <span class="tab-icon">
                    <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path
                            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </span>
                <span class="tab-text">Settings</span>
            </button>
        </nav>

        <div class="sidebar-bottom">
            <div class="user-profile">
                <div class="user-avatar-circle">
                    <span id="user-avatar-initial">U</span>
                </div>
                <div class="user-info-text">
                    <div id="username-display" class="username">Username</div>
                    <span id="user-badge" class="badge">Role</span>
                </div>
            </div>
            <button id="logout-btn" class="logout-btn w-full mt-3" title="Sign Out">
                <span class="logout-icon-span">
                    <svg class="tab-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </span>
                <span class="logout-text-span">Logout</span>
            </button>
        </div>
    </aside>
    `;
}
