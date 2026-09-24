# NY Session Direction Predictor — BTC/USD ML Model

A machine learning web application that predicts the direction (**Bullish** / **Bearish**) of the BTC/USD New York trading session based on Previous Day, Asian, and London session dynamics.

---

## ⚡ Quick Start (Run Both Servers in 1 Command)

Open terminal in the project root folder:

### Option A: Shell Script (macOS / Linux)
```bash
./start.sh
```

### Option B: Python Script
```bash
python start.py
```

Both options start the **FastAPI Backend (`http://localhost:8000`)** and **React Frontend (`http://localhost:5173`)** at the same time. Press `Ctrl + C` in the terminal to stop both servers.

---

## 📋 Prerequisites & Installation

Ensure you have installed:
- **Python 3.8+**
- **Node.js 16+** & **npm**

### Install Dependencies:

```bash
# 1. Install Backend Dependencies
pip install fastapi uvicorn pandas joblib requests scikit-learn

# 2. Install Frontend Dependencies
cd frontend && npm install && cd ..
```

---

## 🖥️ Manual Startup (Two Terminals)

If you prefer running them in separate terminals:

### Terminal 1: Backend
```bash
cd "/Volumes/Desk_Data/darshan/Sem 5/ML LAB/ML PROJECT"
uvicorn app:app --reload --port 8000
```

### Terminal 2: Frontend
```bash
cd "/Volumes/Desk_Data/darshan/Sem 5/ML LAB/ML PROJECT/frontend"
npm run dev
```

---

## 💡 How to Use the App

1. Open `http://localhost:5173` in your browser.
2. Select a **Trade Date** (e.g. `2025-08-29`).
3. Click **"⚡ Fetch & Predict"**:
   - Fetches BTC/USDT 1-minute data from Binance API for that date.
   - Automatically computes all 11 session features.
   - Runs model prediction & displays Bullish/Bearish prediction with probabilities.
4. Click **"▼ Show Computed Features"** to inspect feature values.
