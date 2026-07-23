// Component Registry — Synchronous ES6 HTML Component Injector
import { renderScreensComponent } from './components/screensComponent.js';
import { renderTopBarComponent } from './components/topBarComponent.js';
import { renderSidebarComponent } from './components/sidebarComponent.js';
import { renderEntryFormTabComponent } from './components/entryFormTabComponent.js';
import { renderSpreadsheetTabComponent } from './components/spreadsheetTabComponent.js';
import { renderDashboardTabComponent } from './components/dashboardTabComponent.js';
import { renderReportTabComponent } from './components/reportTabComponent.js';
import { renderSettingsTabComponent } from './components/settingsTabComponent.js';
import { renderModalsComponent } from './components/modalsComponent.js';
import { renderStatusBarComponent } from './components/statusBarComponent.js';

export function mountAllComponents() {
    const mountTargets = {
        "mount-screens": renderScreensComponent(),
        "mount-topbar": renderTopBarComponent(),
        "mount-sidebar": renderSidebarComponent(),
        "mount-entry-form-tab": renderEntryFormTabComponent(),
        "mount-spreadsheet-tab": renderSpreadsheetTabComponent(),
        "mount-dashboard-tab": renderDashboardTabComponent(),
        "mount-report-tab": renderReportTabComponent(),
        "mount-settings-tab": renderSettingsTabComponent(),
        "mount-modals": renderModalsComponent(),
        "mount-statusbar": renderStatusBarComponent()
    };

    Object.entries(mountTargets).forEach(([targetId, htmlContent]) => {
        const el = document.getElementById(targetId);
        if (el) {
            el.outerHTML = htmlContent;
        }
    });
}
