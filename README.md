# Mobileum SafeFamily™ — Child Spam Call Alert System

[![Repository](https://img.shields.io/badge/GitHub-Mobileum--safeFamily-181717?logo=github)](https://github.com/Kishan-S-maker/Mobileum-safeFamily-.git)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express)](https://expressjs.com)
[![ExcelJS](https://img.shields.io/badge/Database-ExcelJS-217346?logo=microsoft-excel)](https://github.com/exceljs/exceljs)

An enterprise-grade telecom security platform demonstration designed for mobile network operators (MNOs) to safeguard minor subscriber lines against malicious robocalls, financial phishing, IRS impersonators, and aggressive telemarketers.

---

## 🌟 Core System Capabilities

### 1. Dual Subscriber Classification (`Child <18` vs `Adult 18+`)
- Categorizes telecom lines into **Protected Minor Lines (Child)** and **Authorized Adults & Guardians (18+)**.
- Tracks subscriber identity, registered MSISDN phone number, and verified contact email.

### 2. Intelligent Parent-Child Linkage & Policy Matrix
- **Spam Calls Targeting a Minor (Child)**:
  - Real-time carrier intercept triggers immediate SMTP email delivery to all linked active guardians.
  - High-priority simulated carrier SMS dispatch with automated advisory guidelines.
  - Complete call telemetry logged to Excel.
- **Calls Targeting an Adult / Guardian**:
  - The call connects and disconnects normally without disturbance.
  - **Zero alerts**: Policy engine bypasses email and SMS notifications (`CALL ALLOWED (ADULT SUBSCRIBER - NO GUARDIAN ALERT NEEDED)`).
- **Legitimate Callers**:
  - Automatically verified as safe; normal connection allowed with no alerts dispatched.

### 3. Dual Smartphone Interactive Experience
- **Spam Caller Interactive Dialer (Left Phone)**:
  - Functional mobile dialpad (0–9, *, #) with tactile audio-visual response.
  - Real-time threat classification engine displaying caller identity, risk score, reputation status, and threat category.
  - Recipient selection dropdown grouping lines into Minor Lines and Authorized Guardians.
  - Call timer and Start / End call triggers.
- **Receiver Mobile Terminal (Right Phone)**:
  - Realistic smartphone UI with dynamic notch, status bar, and ringing animations.
  - Real-time caller ID presentation and threat badge warnings.
  - Interactive Answer, Reject, and End Call actions.
  - Live in-call controls (Mute, Speaker, Duration timer).
  - Telecom notification audit panel showing SMTP delivery receipt and carrier SMS delivery state.

### 4. Subscriber & Family Automation
- Child-first subscriber directory showing parent/guardian associations.
- **Add Subscriber**: Easily register child details with one or more linked guardians.
- **View Parents / Guardians Modal**: Pop-up window displaying guardian contact details with direct inline editing and instant workbook synchronization.
- **Multi-Select Bulk Operations**: Checkboxes for batch deletion with automated orphan guardian cleanup.

### 5. Optimized Call Logs & Telemetry
- Responsive table layout visible without lateral scrolling.
- Real-time filtering by classification (All, Spam Intercepted, Legitimate Calls).
- Instant "Clear All Records" feature with safe backward row-splicing Excel persistence.
- Export to Excel and CSV.

### 6. Email Studio & SMTP Gateway
- Dynamic HTML & plaintext notification template editor with variable placeholders (`{{parent_name}}`, `{{child_name}}`, `{{caller_number}}`, `{{child_phone}}`, `{{spam_classification}}`, `{{event_time}}`).
- Built-in SMTP configuration diagnostic tester.

---

## 📁 Repository Structure

```
Mobileum-safeFamily/
├── client/                     # Vite + React + TypeScript Frontend
│   ├── src/
│   │   ├── api/client.ts       # Backend REST API client
│   │   ├── components/         # UI tabs (SpamCallerTab, ReceiverEndTab, SubscribersTab, etc.)
│   │   ├── types.ts            # Frontend TypeScript definitions
│   │   ├── App.tsx             # Main application orchestrator
│   │   └── main.tsx            # React DOM root entry
│   ├── index.html              # HTML shell
│   ├── package.json            # Client dependencies
│   └── vite.config.ts          # Vite build & proxy configuration
├── server/                     # Express + TypeScript Backend
│   ├── src/
│   │   ├── config.ts           # Server port & Excel path resolver
│   │   ├── emailService.ts     # Nodemailer SMTP engine with HTML templates
│   │   ├── excelService.ts     # ExcelJS concurrency-safe workbook engine
│   │   ├── smsService.ts       # Simulated carrier SMS delivery gateway
│   │   ├── spamEngine.ts       # Threat classification & rule evaluation
│   │   ├── routes/api.ts       # REST endpoints for calls, subscribers, spam & logs
│   │   └── index.ts            # Express server entry point & static UI host
│   ├── child_spam_alert_demo_data.xlsx # Primary Excel database
│   ├── package.json            # Server dependencies
│   ├── tsconfig.json           # Server TypeScript config
│   └── .env.example            # Backend environment template
├── .env.example                # Root environment template
├── .gitignore                  # Git ignore rules (protects credentials)
├── package.json                # Root orchestration scripts
└── README.md                   # Project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/Kishan-S-maker/Mobileum-safeFamily-.git
cd Mobileum-safeFamily
```

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Configure Environment (Optional for Real Email Delivery)
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Bash / macOS / Linux
cp .env.example .env
```

To enable live email delivery to guardian inboxes via Gmail SMTP, update `.env`:
```env
PORT=5000
EXCEL_PATH=./child_spam_alert_demo_data.xlsx

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-gmail-app-password
EMAIL_FROM="SafeFamily Telecom Security" <noreply@telecom-security.com>
```
> **Note**: If SMTP credentials are omitted, the application runs in demonstration mode where all call flows, logs, and simulated carrier SMS operate normally without crashing.

### 4. Build and Run
Build both frontend and backend bundles:
```bash
npm run build
```

Start the production server:
```bash
npm start
```
Access the application at: **`http://localhost:5000`**

### 5. Development Mode (Hot-Reload)
Run the server and client concurrently for active development:
```bash
# Terminal 1: Backend API
npm run dev:server

# Terminal 2: Vite Dev Server
npm run dev:client
```
Client runs at `http://localhost:5173` with proxying to the backend on `http://localhost:5000`.

---

## 🛡️ Telecom Security Policy Matrix

| Receiver Line Type | Incoming Caller | Policy Decision | Guardian Email | Carrier SMS |
| :--- | :--- | :--- | :--- | :--- |
| **Child (<18)** | **Spam Caller** | `PARENT ALERTS SENT` | ✅ Dispatched via SMTP | ✅ Dispatched via Carrier |
| **Child (<18)** | **Legitimate** | `CALL ALLOWED (VERIFIED SAFE)` | ⏭️ Skipped | ⏭️ Skipped |
| **Adult / Guardian** | **Spam Caller** | `CALL ALLOWED (ADULT SUBSCRIBER)` | ⏭️ Skipped | ⏭️ Skipped |
| **Adult / Guardian** | **Legitimate** | `CALL ALLOWED (VERIFIED SAFE)` | ⏭️ Skipped | ⏭️ Skipped |

---

## 📄 License
This project is proprietary demonstration software created for Mobileum Telecom Security presentations.
