from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import requests
from datetime import datetime, date, timedelta, timezone

# ── Load the trained model ──────────────────────────────────────────────────
model = joblib.load("NY_Predict.pkl")

app = FastAPI(title="NY Direction Predictor")

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines"


# ── Helpers ─────────────────────────────────────────────────────────────────

def dt_to_ms(dt: datetime) -> int:
    """Convert a UTC-aware datetime to Binance millisecond timestamp."""
    return int(dt.timestamp() * 1000)


def fetch_klines(symbol: str, interval: str, start_ms: int, end_ms: int, limit: int = 1000):
    """Fetch klines from Binance with a single request."""
    params = {
        "symbol": symbol,
        "interval": interval,
        "startTime": start_ms,
        "endTime": end_ms,
        "limit": limit,
    }
    try:
        resp = requests.get(BINANCE_KLINES_URL, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Binance API error: {str(e)}")


def ohlc_from_klines(klines: list) -> dict:
    """Extract OHLC from a list of Binance 1-minute kline rows."""
    if not klines:
        return None
    opens  = [float(k[1]) for k in klines]
    highs  = [float(k[2]) for k in klines]
    lows   = [float(k[3]) for k in klines]
    closes = [float(k[4]) for k in klines]
    return {
        "open":  opens[0],
        "high":  max(highs),
        "low":   min(lows),
        "close": closes[-1],
    }


# ── Manual predict endpoint (legacy) ────────────────────────────────────────

class FeaturesInput(BaseModel):
    Prev_Return:      float
    Prev_Range_Pct:   float
    Prev_Direction:   int
    Asian_Return:     float
    Asian_Range_Pct:  float
    Asian_Direction:  int
    London_Return:    float
    London_Range_Pct: float
    London_Direction: int
    Dist_Prev_High:   float
    Dist_Prev_Low:    float


@app.get("/")
def home():
    return {"message": "NY Direction Predictor API is running!"}


@app.post("/predict")
def predict(data: FeaturesInput):
    input_df = pd.DataFrame([data.dict()])
    prediction    = int(model.predict(input_df)[0])
    probabilities = model.predict_proba(input_df)[0].tolist()
    return {
        "prediction":          prediction,
        "probability_class_0": probabilities[0],
        "probability_class_1": probabilities[1],
    }


# ── Auto predict-by-date endpoint ────────────────────────────────────────────

@app.get("/predict-by-date")
def predict_by_date(date: str = Query(..., description="Trade date in YYYY-MM-DD format")):
    """
    Given a trade date (YYYY-MM-DD), fetch BTC/USDT 1-min data from Binance,
    calculate all 11 session features, and return a prediction.

    Session windows (all UTC):
      - Previous Day  : full calendar day before `date`
      - Asian session : 00:00 – 08:00 UTC on `date`
      - London session: 08:00 – 13:30 UTC on `date`
      - NY open price : 13:00 UTC on `date`  (for Dist_Prev_High / Dist_Prev_Low)
    """
    # ── Parse date ────────────────────────────────────────────────────────
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    prev_date = target_date - timedelta(days=1)
    UTC = timezone.utc

    # ── 1. Previous day daily candle ──────────────────────────────────────
    prev_day_start = datetime(prev_date.year, prev_date.month, prev_date.day, 0, 0, tzinfo=UTC)
    prev_day_end   = datetime(prev_date.year, prev_date.month, prev_date.day, 23, 59, tzinfo=UTC)

    prev_klines = fetch_klines("BTCUSDT", "1d", dt_to_ms(prev_day_start), dt_to_ms(prev_day_end), limit=2)
    if not prev_klines:
        raise HTTPException(status_code=400, detail=f"No data found for previous day ({prev_date}). Binance may not have data this far back.")

    prev_open  = float(prev_klines[0][1])
    prev_high  = float(prev_klines[0][2])
    prev_low   = float(prev_klines[0][3])
    prev_close = float(prev_klines[0][4])

    Prev_Return     = ((prev_close - prev_open) / prev_open) * 100
    Prev_Range_Pct  = ((prev_high  - prev_low)  / prev_open) * 100
    Prev_Direction  = 1 if prev_close > prev_open else 0

    # ── 2. Asian session (00:00 – 08:00 UTC on target date) ──────────────
    asian_start = datetime(target_date.year, target_date.month, target_date.day, 0,  0,  tzinfo=UTC)
    asian_end   = datetime(target_date.year, target_date.month, target_date.day, 7, 59,  tzinfo=UTC)

    asian_klines = fetch_klines("BTCUSDT", "1m", dt_to_ms(asian_start), dt_to_ms(asian_end), limit=480)
    if not asian_klines:
        raise HTTPException(status_code=400, detail="No Asian session data found. The session may not have completed yet.")

    asian = ohlc_from_klines(asian_klines)
    Asian_Return    = ((asian["close"] - asian["open"]) / asian["open"]) * 100
    Asian_Range_Pct = ((asian["high"]  - asian["low"])  / asian["open"]) * 100
    Asian_Direction = 1 if asian["close"] > asian["open"] else 0

    # ── 3. London session (08:00 – 13:30 UTC on target date) ─────────────
    london_start = datetime(target_date.year, target_date.month, target_date.day, 8,  0,  tzinfo=UTC)
    london_end   = datetime(target_date.year, target_date.month, target_date.day, 13, 29, tzinfo=UTC)

    london_klines = fetch_klines("BTCUSDT", "1m", dt_to_ms(london_start), dt_to_ms(london_end), limit=330)
    if not london_klines:
        raise HTTPException(status_code=400, detail="No London session data found. The session may not have completed yet (London closes at 13:30 UTC).")

    london = ohlc_from_klines(london_klines)
    London_Return    = ((london["close"] - london["open"]) / london["open"]) * 100
    London_Range_Pct = ((london["high"]  - london["low"])  / london["open"]) * 100
    London_Direction = 1 if london["close"] > london["open"] else 0

    # ── 4. NY open price at 13:00 UTC (for distance features) ────────────
    ny_open_ms  = dt_to_ms(datetime(target_date.year, target_date.month, target_date.day, 13, 0, tzinfo=UTC))
    ny_klines   = fetch_klines("BTCUSDT", "1m", ny_open_ms, ny_open_ms + 60_000, limit=2)
    if not ny_klines:
        raise HTTPException(status_code=400, detail="No NY open price found. The NY session may not have started yet (NY opens at 13:00 UTC / 6:30 PM IST).")

    ny_open_price = float(ny_klines[0][1])

    Dist_Prev_High = ((ny_open_price - prev_high) / prev_high) * 100
    Dist_Prev_Low  = ((ny_open_price - prev_low)  / prev_low)  * 100

    # ── 5. Build feature dict & predict ──────────────────────────────────
    features = {
        "Prev_Return":     round(Prev_Return,     6),
        "Prev_Range_Pct":  round(Prev_Range_Pct,  6),
        "Prev_Direction":  Prev_Direction,
        "Asian_Return":    round(Asian_Return,     6),
        "Asian_Range_Pct": round(Asian_Range_Pct,  6),
        "Asian_Direction": Asian_Direction,
        "London_Return":   round(London_Return,    6),
        "London_Range_Pct":round(London_Range_Pct, 6),
        "London_Direction":London_Direction,
        "Dist_Prev_High":  round(Dist_Prev_High,   6),
        "Dist_Prev_Low":   round(Dist_Prev_Low,    6),
    }

    input_df      = pd.DataFrame([features])
    prediction    = int(model.predict(input_df)[0])
    probabilities = model.predict_proba(input_df)[0].tolist()

    return {
        "date":                date,
        "prediction":          prediction,
        "probability_class_0": round(probabilities[0], 4),
        "probability_class_1": round(probabilities[1], 4),
        "features":            features,
        "market_data": {
            "prev_date":       str(prev_date),
            "prev_open":       prev_open,
            "prev_high":       prev_high,
            "prev_low":        prev_low,
            "prev_close":      prev_close,
            "asian_open":      asian["open"],
            "asian_close":     asian["close"],
            "london_open":     london["open"],
            "london_close":    london["close"],
            "ny_open_price":   ny_open_price,
        },
    }