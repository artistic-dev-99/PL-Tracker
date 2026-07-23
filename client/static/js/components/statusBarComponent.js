// Bottom IDE Status Bar Component
export function renderStatusBarComponent() {
    return `
    <footer class="ide-status-bar" id="ide-status-bar">
        <div class="status-bar-left">
            <span class="status-item online-item" id="sb-server-status"><span class="status-dot green"></span> 127.0.0.1:5000</span>
            <span class="status-divider">|</span>
            <span class="status-item" id="sb-user-info">User: Guest</span>
            <span class="status-divider">|</span>
            <span class="status-item" id="sb-mode-info">Entry Form</span>
        </div>
        <div class="status-bar-right">
            <span class="status-item">UTF-8</span>
            <span class="status-divider">|</span>
            <span class="status-item">SQLite Database</span>
            <span class="status-divider">|</span>
            <span class="status-item">PL Tracker v2.0</span>
        </div>
    </footer>
    `;
}
