# Karnataka Police Crime Analytics Platform
An advanced, premium intelligence platform for tracking crime patterns, predicting hotspots, conducting co-accused network analysis, and interacting with crime databases using NVIDIA NIM-powered conversational AI.

---

## 📂 Project Structure

```
datathon/
├── backend/               # Python FastAPI backend (Zoho Catalyst AppSail)
│   ├── app/
│   │   ├── core/         # Config, security, permissions, NIM clients
│   │   ├── db/           # Catalyst Data Store sandbox adapter
│   │   ├── models/       # Pydantic schemas (cases, users, analytics)
│   │   ├── routers/      # Auth, Cases, Chat, Network, Risk, Forecast, Admin
│   │   └── services/     # RAG, NL2SQL, NetworkX Community Detection
│   ├── data/             # Seeding script (2,000 cases, 3,984 accused)
│   ├── app.py            # AppSail entrypoint (Uvicorn runner)
│   └── app-config.json   # Catalyst AppSail config
├── frontend/             # Next.js 16 Web App (Zoho Catalyst Slate)
│   ├── app/              # Dashboard pages, login, layouts, and styles
│   ├── components/       # Premium Sidebar, Header, widgets
│   ├── lib/              # API client integration
│   └── store/            # Zustand global state (Auth)
└── scripts/              # Table guides and manuals
```

---

## ⚡ How to Setup & Run

### Prerequisites
* **Python** (version 3.10 to 3.13)
* **Node.js & npm**
* **Catalyst CLI** (`npm i -g zcatalyst-cli-v2` or `npm i -g zcatalyst-cli`)

---

### 1. Run the Backend API
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip3 install -r requirements.txt
   ```
3. Set your NVIDIA API Key (Required for live NIM Chat/NLP, falls back to offline keyword indexing if key is missing):
   ```bash
   export NVIDIA_API_KEY="your_nvidia_nim_api_key"
   ```
4. Start the backend server:
   ```bash
   python3 app.py
   ```
   * The API will boot on `http://localhost:8000`.
   * On startup, it automatically seeds the database sandbox with **2,000 cases** and **3,984 accused** for immediate testing.

---

### 2. Run the Next.js Frontend
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   * Open `http://localhost:3000` in your web browser.

---

## 🔑 Demo Accounts
Login using one of the pre-configured accounts:

| Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin` | Administrator | Full access + User Provisioning |
| **`inspector_ravi`** | `ravi123` | Investigator | Add/Edit cases, view PII details |
| **`analyst_priya`** | `priya123` | Analyst | Cross-station dashboards, trends |
| **`sp_kumar`** | `kumar123` | Supervisor | District-level oversight + Audit logs |

---

## ☁️ Deploy to Zoho Catalyst Cloud

1. Ensure you are logged in to the CLI:
   ```bash
   catalyst login
   ```
2. Initialize or connect your project:
   ```bash
   catalyst project:use datathon
   ```
3. Deploy both Slate (frontend) and AppSail (backend):
   ```bash
   catalyst deploy
   ```
4. Remember to create the database tables in your cloud console first using the **[scripts/create_tables_guide.md](file:///home/bharath/Desktop/projects/datathon/scripts/create_tables_guide.md)**.
