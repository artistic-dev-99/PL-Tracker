# PL Tracker 2 - Enterprise Packing List Tracking System

An enterprise-grade, web-based Packing List tracking, entry processing, user management, and analytics solution built with Python Flask (Modular Architecture), SQLite, and Vanilla HTML5/CSS3/JavaScript.

---

## 🌟 Key Features

- **Sequential Tracking ID Engine**: Calculates `MasterUniqueID`, `UniqueIDByUser` (e.g. `A001`), `DailyCountID`, `UserDailyCountID`, and `UniqueIDByDayByUser` (`A001`).
- **Dynamic PL Mode (`Mail` / `Manual`)**: Mutually exclusive selection for tracking entry input modes.
- **Excel Data Import Sub-Tab**: Process raw `.xlsm` / `.xlsx` files (`Raw PL Data.xlsm`), sort records chronologically, map operators, and auto-generate linked tracking IDs.
- **User Management Sub-Tab**:
  - **Local Users**: Personal credentials card and direct password modification without admin approval.
  - **Admin Users**: Registered operators panel, role management, password resets, account deletion options, and real-time working status indicators.
- **Real-Time Operator Presence**: Live heartbeat indicator (`🟢 Working Now`, `🟡 Idle`, `⚪ Offline`).
- **Search & Record Navigation**: Search mode (F11) withPrev/Next record stepping, load/edit/delete capabilities.
- **Responsive Layout**: Compact sidebar with icon-only collapse state (`64px`) and tooltips.

---

## 🚀 Architecture Overview

```
PL Tracker 2/
├── .env.example                # Environment variables template
├── README.md                   # System documentation & API guide
├── client/
│   └── static/
│       ├── index.html          # Single Page Application HTML shell
│       ├── app.js              # State management & client interactions
│       ├── style.css           # Modular CSS & glassmorphism theme
│       └── BG_1.jpg            # Application background artwork
├── server/
│   ├── app.py                  # Flask Application Factory & middleware
│   ├── config.py               # Environment configuration loader
│   ├── db.py                   # SQLite connection manager & schema migrations
│   ├── logger.py               # Structured JSON logging formatter
│   ├── server.py               # Application entrypoint
│   ├── controllers/            # API Route Handlers (Blueprints)
│   │   ├── auth_controller.py
│   │   ├── entries_controller.py
│   │   ├── excel_controller.py
│   │   ├── system_controller.py
│   │   └── users_controller.py
│   ├── services/               # Core Business Logic Layer
│   │   ├── auth_service.py
│   │   ├── entry_service.py
│   │   ├── excel_service.py
│   │   └── user_service.py
│   └── utils/                  # Schema Validation & Helpers
│       └── validators.py
└── tests/                      # Automated Unit Test Suite
    ├── test_auth.py
    └── test_entries.py
```

---

## 🛠️ Setup & Local Execution

### 1. Requirements
- Python 3.9+
- Dependencies: `Flask`, `Flask-CORS`, `bcrypt`

### 2. Installation
```bash
# Install dependencies
pip install flask flask-cors bcrypt
```

### 3. Running the Application Server
```bash
# Start Flask API server on http://localhost:5000
python server/server.py
```

---

## 🧪 Running Automated Tests

```bash
# Run unit test suite
python -m unittest discover -s tests
```

---

## 📖 API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check |
| `GET` | `/api/db-status` | Database initialization check |
| `POST` | `/api/auth/setup` | Create initial Admin account |
| `POST` | `/api/auth/login` | Authenticate user |
| `POST` | `/api/auth/register` | Register operator account (Admin) |
| `POST` | `/api/entries/submit` | Submit Packing List entry |
| `GET` | `/api/entries/query` | Query entries with filters |
| `PUT` | `/api/entries/query` | Update existing entry |
| `DELETE`| `/api/entries/delete` | Delete entries |
| `GET` | `/api/users/list` | Fetch operators with live working status |
| `POST` | `/api/users/heartbeat` | Update operator active timestamp |
| `POST` | `/api/users/update` | Update username, password, or role |
| `DELETE`| `/api/users/delete` | Delete user account |
| `POST` | `/api/admin/import-excel` | Import raw Excel data (.xlsm/.xlsx) |
