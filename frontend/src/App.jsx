import { useState } from 'react'
import './index.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/* Today's date in YYYY-MM-DD (local) */
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

/* Format a number to fixed decimals, with sign */
function fmt(v, d = 2) {
  if (v === undefined || v === null) return '—'
  const n = parseFloat(v)
  return (n >= 0 ? '+' : '') + n.toFixed(d)
}

// Session timing hint (IST = UTC+5:30)
const SESSION_TIMES = [
  { label: 'Asian Session',  utc: '00:00 – 08:00 UTC', ist: '05:30 – 13:30 IST', color: '#333' },
  { label: 'London Session', utc: '08:00 – 13:30 UTC', ist: '13:30 – 19:00 IST', color: '#333' },
  { label: 'NY Opens',       utc: '13:00 UTC',          ist: '18:30 IST',          color: '#333' },
]

// Feature label mapping for the detail table
const FEATURE_META = [
  { key: 'Prev_Return',      label: 'Prev Day Return',    unit: '%',  session: 'Previous Day' },
  { key: 'Prev_Range_Pct',   label: 'Prev Day Range',     unit: '%',  session: 'Previous Day' },
  { key: 'Prev_Direction',   label: 'Prev Day Direction', unit: '',   session: 'Previous Day' },
  { key: 'Asian_Return',     label: 'Asian Return',       unit: '%',  session: 'Asian' },
  { key: 'Asian_Range_Pct',  label: 'Asian Range',        unit: '%',  session: 'Asian' },
  { key: 'Asian_Direction',  label: 'Asian Direction',    unit: '',   session: 'Asian' },
  { key: 'London_Return',    label: 'London Return',      unit: '%',  session: 'London' },
  { key: 'London_Range_Pct', label: 'London Range',       unit: '%',  session: 'London' },
  { key: 'London_Direction', label: 'London Direction',   unit: '',   session: 'London' },
  { key: 'Dist_Prev_High',   label: 'Dist. Prev High',    unit: '%',  session: 'NY Open' },
  { key: 'Dist_Prev_Low',    label: 'Dist. Prev Low',     unit: '%',  session: 'NY Open' },
]

function DirectionBadge({ value }) {
  const v = parseInt(value)
  if (v === 1) return <span className="dir-badge bullish">▲ Bullish (1)</span>
  return <span className="dir-badge bearish">▼ Bearish (0)</span>
}

function HowToUse() {
  return (
    <div className="guide-content">
      <h2>How to Use the Predictor</h2>
      <p>Simply pick a trading date and click <strong>"Fetch &amp; Predict"</strong>. The system automatically fetches live BTC/USD data from Binance and computes all session features before running the ML model.</p>

      <div className="session-timing-grid">
        {SESSION_TIMES.map(s => (
          <div className="session-timing-card" key={s.label}>
            <div className="st-label">{s.label}</div>
            <div className="st-utc">{s.utc}</div>
            <div className="st-ist">{s.ist}</div>
          </div>
        ))}
      </div>

      <h3>Feature Descriptions</h3>
      <table className="guide-table">
        <thead>
          <tr><th>Feature</th><th>Session</th><th>Formula</th></tr>
        </thead>
        <tbody>
          <tr><td>Prev Return</td><td>Previous Day</td><td>(Close − Open) / Open × 100</td></tr>
          <tr><td>Prev Range %</td><td>Previous Day</td><td>(High − Low) / Open × 100</td></tr>
          <tr><td>Prev Direction</td><td>Previous Day</td><td>1 if Bullish, 0 if Bearish</td></tr>
          <tr><td>Asian Return</td><td>00:00–08:00 UTC</td><td>(Close − Open) / Open × 100</td></tr>
          <tr><td>Asian Range %</td><td>00:00–08:00 UTC</td><td>(High − Low) / Open × 100</td></tr>
          <tr><td>Asian Direction</td><td>00:00–08:00 UTC</td><td>1 if Bullish, 0 if Bearish</td></tr>
          <tr><td>London Return</td><td>08:00–13:30 UTC</td><td>(Close − Open) / Open × 100</td></tr>
          <tr><td>London Range %</td><td>08:00–13:30 UTC</td><td>(High − Low) / Open × 100</td></tr>
          <tr><td>London Direction</td><td>08:00–13:30 UTC</td><td>1 if Bullish, 0 if Bearish</td></tr>
          <tr><td>Dist. Prev High</td><td>NY Open (13:00 UTC)</td><td>(NY Open − Prev High) / Prev High × 100</td></tr>
          <tr><td>Dist. Prev Low</td><td>NY Open (13:00 UTC)</td><td>(NY Open − Prev Low) / Prev Low × 100</td></tr>
        </tbody>
      </table>

      <h3>Important Notes</h3>
      <ul>
        <li>The model predicts the <strong>NY session direction</strong> (13:00–20:00 UTC).</li>
        <li>For the prediction to work, the <strong>London session must have closed</strong> (after 13:30 UTC / 19:00 IST).</li>
        <li>Data is fetched live from <strong>Binance (BTCUSDT)</strong> — dates must have available market data.</li>
        <li>The model was trained on BTC/USD 1-minute data from 2020–2026.</li>
      </ul>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('predict')
  const [selectedDate, setSelectedDate]  = useState('2025-08-29')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [showFeatures, setShowFeatures] = useState(false)

  const handlePredict = async () => {
    setError('')
    setResult(null)
    setShowFeatures(false)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/predict-by-date?date=${selectedDate}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || `Server error ${res.status}`)
      }
      setResult(data)
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('Cannot connect to the API. Make sure your FastAPI server is running: uvicorn app:app --reload')
      } else {
        setError(err.message || 'An unexpected error occurred.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isBullish    = result?.prediction === 1
  const probBullish  = result ? result.probability_class_1 : 0
  const probBearish  = result ? result.probability_class_0 : 0
  const confidence   = result ? Math.max(probBullish, probBearish) * 100 : 0

  return (
    <div className="layout">
      {/* Network Background SVG */}
      <div className="bg-pattern">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="net" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M100 0 L200 100 L100 200 L0 100 Z" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
              <circle cx="100" cy="0" r="3" fill="#D1D5DB"/>
              <circle cx="200" cy="100" r="3" fill="#D1D5DB"/>
              <circle cx="100" cy="200" r="3" fill="#D1D5DB"/>
              <circle cx="0" cy="100" r="3" fill="#D1D5DB"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#net)"/>
        </svg>
      </div>

      <nav className="navbar">
        <div className="nav-logo">NY.PREDICTOR 🐎</div>
        <div className="nav-links">
          <button className={`nav-link ${activeTab === 'predict' ? 'active' : ''}`} onClick={() => setActiveTab('predict')}>Predict</button>
          <button className={`nav-link ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>Guide</button>
        </div>
      </nav>

      <main className="main-content">
        <header className="hero">
          <div className="hero-tag">◆ BTC/USD · ML PREDICTOR</div>
          <h1 className="hero-title">
            I predict NY market moves,<br />
            using <span className="highlight-italic">models</span> that explain themselves.
          </h1>
          <p className="hero-subtitle">
            Machine learning practitioner specializing in scalable FastAPI/React architectures. 
            Proven experience building end-to-end platforms and deploying intelligent features.
            Predicting BTC/USD direction for the NY Session with high-confidence insights.
          </p>
        </header>

        {activeTab === 'guide' ? (
          <div className="content-box">
             <HowToUse />
          </div>
        ) : (
          <div className="app-container">
            <div className="action-row">
              <div className="input-group">
                <input
                  id="trade-date"
                  type="date"
                  className="minimal-input"
                  value={selectedDate}
                  max={todayStr()}
                  onChange={e => { setSelectedDate(e.target.value); setResult(null); setError('') }}
                />
              </div>
              <button
                className={`btn-primary ${loading ? 'loading' : ''}`}
                onClick={handlePredict}
                disabled={loading || !selectedDate}
              >
                {loading ? 'Fetching & Computing…' : 'Fetch & Predict'}
              </button>
            </div>

            <div className="session-strip">
              {SESSION_TIMES.map(s => (
                <div className="ss-item" key={s.label}>
                  <span className="ss-label">{s.label}</span>
                  <span className="ss-time">{s.ist}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="error-msg">
                {error}
              </div>
            )}

            {result && (
              <div className="result-container">
                <div className="result-header">
                  <div className="res-meta">
                    <span className="res-date">{result.date}</span>
                    <span className="res-subtitle">NY Session Direction (13:00–20:00 UTC)</span>
                  </div>
                  <h2 className={`res-title ${isBullish ? 'bullish' : 'bearish'}`}>
                    {isBullish ? '▲ Bullish' : '▼ Bearish'}
                  </h2>
                  <div className="res-confidence">
                    <strong>{confidence.toFixed(1)}%</strong> Confidence
                  </div>
                </div>

                <div className="prob-section">
                  <div className="prob-item">
                    <div className="prob-labels">
                      <span>Bullish (Class 1)</span>
                      <span className="prob-pct green">{(probBullish * 100).toFixed(1)}%</span>
                    </div>
                    <div className="prob-bar-wrap">
                      <div className="prob-bar green" style={{ width: `${probBullish * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="prob-item mt-3">
                    <div className="prob-labels">
                      <span>Bearish (Class 0)</span>
                      <span className="prob-pct red">{(probBearish * 100).toFixed(1)}%</span>
                    </div>
                    <div className="prob-bar-wrap">
                      <div className="prob-bar red" style={{ width: `${probBearish * 100}%` }}></div>
                    </div>
                  </div>
                </div>

                {result.market_data && (
                  <div className="market-snapshot">
                    <div className="snap-box">
                      <span className="snap-label">Prev Close</span>
                      <span className="snap-val">${result.market_data.prev_close?.toLocaleString()}</span>
                    </div>
                    <div className="snap-box">
                      <span className="snap-label">NY Open</span>
                      <span className="snap-val">${result.market_data.ny_open_price?.toLocaleString()}</span>
                    </div>
                    <div className="snap-box">
                      <span className="snap-label">Prev High</span>
                      <span className="snap-val">${result.market_data.prev_high?.toLocaleString()}</span>
                    </div>
                    <div className="snap-box">
                      <span className="snap-label">Prev Low</span>
                      <span className="snap-val">${result.market_data.prev_low?.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <div className="features-toggle">
                  <button onClick={() => setShowFeatures(!showFeatures)}>
                    {showFeatures ? '– Hide' : '+ Show'} Computed Features
                  </button>
                </div>

                {showFeatures && result.features && (
                  <div className="features-grid">
                    {FEATURE_META.map(f => {
                      const val = result.features[f.key]
                      const isDir = f.key.includes('Direction')
                      return (
                        <div className="feat-box" key={f.key}>
                          <div className="feat-session">{f.session}</div>
                          <div className="feat-label">{f.label}</div>
                          <div className="feat-val">
                            {isDir ? (
                              <DirectionBadge value={val} />
                            ) : (
                              <span className={parseFloat(val) >= 0 ? 'bullish-text' : 'bearish-text'}>
                                {fmt(val)}%
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
