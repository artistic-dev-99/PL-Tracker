# PL Tracker 2 - Master Feature Index

This document serves as the ground truth feature inventory for **PL Tracker 2**. All AI agents working on this codebase must consult this file before making additions or refactors to avoid overwriting active functionality.

---

## 🖥️ Client (UI / Components)
- **Single Page Application Shell (`client/static/index.html`)**:
  - Header with title, user info, role badges, live heartbeat status indicator.
  - Collapsible Sidebar with navigation items (Tracking Input, Users, Excel Import, Analytics/Spreadsheet).
  - Component view container loading HTML modules dynamically.
- **Client Components (`client/static/components/` & `js/components/`)**:
  - `firstTimeScreen.html`: Admin setup form for fresh database initialization.
  - `dashboardTab.html`: Main Packing List entry form (Mail & Manual modes, sequential ID calculation, F11 search mode, prev/next navigation).
  - `spreadsheetTabComponent.js` / Spreadsheet View: Tabular view and bulk data inspection.
  - Navigation styles: `client/static/css/navigation.css`.

---

## ⚙️ Server (Controllers & Services)
- **API Controllers (`server/controllers/`)**:
  - `auth_controller.py`: Initial admin setup (`/api/auth/setup`), Login (`/api/auth/login`).
  - `users_controller.py`: Operator registration, user listing (`/api/users/list`), heartbeat (`/api/users/heartbeat`), user updates & deletion.
  - `entries_controller.py`: Entry submission (`/api/entries/submit`), entry querying (`/api/entries/query`), update, and deletion.
  - `excel_controller.py`: Raw Excel `.xlsm`/`.xlsx` file parsing and import processing (`/api/admin/import-excel`).
  - `system_controller.py`: Database status and health endpoints (`/health`, `/api/db-status`).
- **Core Services (`server/services/`)**:
  - `entry_service.py`: ID generation algorithms (`MasterUniqueID`, `UniqueIDByUser`, `DailyCountID`, `UserDailyCountID`, `UniqueIDByDayByUser`), CRUD operations.
  - `user_service.py`: User authentication, bcrypt password hashing, role enforcement, active heartbeat tracking.
  - `excel_service.py`: Openpyxl integration for processing packing list excel sheets.
  - `auth_service.py`: Token & session management logic.

---

## 🗄️ Database & Schema (`server/db.py`)
- SQLite database (`pl_tracker.db`) managed with parameterized queries and migrations.
- Tables: `users`, `entries`, `import_logs`.

---

## 🧪 Automated Tests (`tests/`)
- `test_auth.py`: Tests for user authentication and authorization logic.
- `test_entries.py`: Tests for entry creation, search, ID calculation, and deletion.
- `test_concurrency.py`: Concurrency and race condition testing for ID generation.
