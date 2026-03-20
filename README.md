# 🚀 MailFlow — Professional Email Automation SaaS

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=white" />
  <img src="https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white" />
</div>

---

**MailFlow** is a powerful, full-stack email automation platform designed for cold outreach and campaign management. Built with a modern tech stack (React 18 + FastAPI), it empowers users to reach their audience at scale while maintaining a personal touch.

## ✨ Core Features

*   **🔐 Seamless Authentication**: Secure login and registration powered by **Firebase Auth**.
*   **📊 Lead Management**: Upload contact lists via CSV with support for custom placeholders.
*   **📧 Personalized Templates**: Craft dynamic email templates using `{name}`, `{company}`, and more tags.
*   **⚡ Automated Campaigns**: Send emails automatically through **Gmail API** with configurable daily limits and delays.
*   **📝 Live Tracking & Logging**: Keep an eye on your progress with real-time stats and automated logging to **Google Sheets**.
*   **⏹️ Mission Control**: Cancel or pause campaigns at any time from a sleek, dark-mode dashboard.

## 🏗️ Project Architecture

```text
mailflow/
├── frontend/          # React + Vite Client
│   ├── src/
│   │   ├── pages/     # Login, Dashboard, New Campaign, Settings
│   │   └── components/# Shared UI Components
├── backend/           # FastAPI Business Logic
│   ├── main.py        # API Routes & OAuth logic
│   └── requirements.txt
└── .gitignore
```

## 🛠️ Tech Stack

*   **Frontend**: React 18, Vite, Firebase SDK
*   **Backend**: Python 3.10+, FastAPI, Pydantic
*   **Integration**: Google OAuth 2.0, Gmail API, Google Sheets API
*   **Infrastructure**: Firebase Admin SDK

## ⚙️ Setup & Installation

### 1. Prerequisites
*   Python 3.10+
*   Node.js (LTS)
*   A Google Cloud Project with Gmail, Sheets, and Drive APIs enabled.

### 2. Environment Variables
Create a `.env` file in the `backend/` directory with the following:
```bash
MAIL_USER=your-email@gmail.com
GOOGLE_SHEET_NAME=My Campaigns Log
FIREBASE_SERVICE_ACCOUNT_JSON='{...}'
GOOGLE_CLIENT_SECRET_JSON='{...}'
```

### 3. Quick Start
**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🚀 Roadmap

- [ ] Support for multiple attachments
- [ ] Advanced CSV field mapping
- [ ] Email open/click tracking analytics
- [ ] AI-powered subject line generator

## 👤 Author

**Roshaan Ali**
*   GitHub: [@RoshaanAwan](https://github.com/RoshaanAwan)
*   LinkedIn: [Roshaan Ali](https://linkedin.com/in/roshaan-ali-dev)

---
<div align="center">
  Made with ❤️ for high-performance outreach.
</div>
