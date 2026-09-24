import { useState } from 'react'
import './index.css'

const API_GATEWAY = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const getMaximumAllowedDate = () => {
  return new Date().toISOString().split('T')[0]
}

const formatMetric = (val, decimals = 2) => {
  if (val === undefined || val === null) return '—'
  const numericVal = parseFloat(val)
  return (numericVal >= 0 ? '+' : '') + numericVal.toFixed(decimals)
}

const QUANT_METRICS_MAP = [
  { dataKey: 'Prev_Return', title: 'Prior Daily Return' },
  { dataKey: 'Prev_Range_Pct', title: 'Prior Daily Volatility' },
  { dataKey: 'Asian_Return', title: 'APAC Return' },
  { dataKey: 'Asian_Range_Pct', title: 'APAC Volatility' },
  { dataKey: 'London_Return', title: 'EMEA Return' },
  { dataKey: 'London_Range_Pct', title: 'EMEA Volatility' },
  { dataKey: 'Dist_Prev_High', title: 'Delta to Prior High' },
  { dataKey: 'Dist_Prev_Low', title: 'Delta to Prior Low' },
]

export default function ForecastApplication() {
  const [targetDay, setTargetDay] = useState('2025-08-29')
  const [isProcessing, setIsProcessing] = useState(false)
  const [forecastData, setForecastData] = useState(null)
  const [fetchError, setFetchError] = useState('')

  const executeForecastQuery = async () => {
    setFetchError('')
    setForecastData(null)
    setIsProcessing(true)

    try {
      const response = await fetch(`${API_GATEWAY}/predict-by-date?date=${targetDay}`)
      const jsonPayload = await response.json()
      
      if (!response.ok) {
        throw new Error(jsonPayload.detail || `Server exception ${response.status}`)
      }
      setForecastData(jsonPayload)
    } catch (err) {
      if (err.message.includes('fetch') || err.message.includes('NetworkError')) {
        setFetchError('CONNECTION REFUSED: Analytics engine offline.')
      } else {
        setFetchError(err.message || 'RUNTIME EXCEPTION OCCURRED.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const isUpward = forecastData?.prediction === 1
  const upwardProb = forecastData ? forecastData.probability_class_1 : 0
  const downwardProb = forecastData ? forecastData.probability_class_0 : 0

  return (
    <div className="document-wrapper">
      
      <header className="doc-header">
        <div className="doc-title-block">
          <h1>QUANT.FORECAST</h1>
          <p>Algorithmic BTC/USD Forecasting Model</p>
        </div>
        <div className="doc-meta">
          <span>REPORT ID: {Math.floor(Math.random() * 1000000)}</span>
          <span>SYSTEM: STANDBY</span>
        </div>
      </header>

      <section className="doc-controls">
        <div className="input-block">
          <label>Target Execution Date</label>
          <input
            type="date"
            className="date-input"
            value={targetDay}
            max={getMaximumAllowedDate()}
            onChange={(e) => setTargetDay(e.target.value)}
          />
        </div>
        <button 
          className="execute-btn" 
          onClick={executeForecastQuery} 
          disabled={isProcessing}
        >
          {isProcessing ? 'COMPUTING...' : 'INITIALIZE QUERY'}
        </button>
      </section>

      {fetchError && <div className="error-banner">{fetchError}</div>}

      {!forecastData && !isProcessing && (
        <div className="status-msg">
          [ AWAITING QUERY INITIALIZATION ]
        </div>
      )}

      {isProcessing && (
        <div className="status-msg">
          [ PROCESSING MARKET DATA... ]
        </div>
      )}

      {forecastData && (
        <main className="doc-content">
          
          <div className="doc-section">
            <div className="section-title">I. Primary Forecast & Confidence</div>
            
            <div className="verdict-row">
              <div className="verdict-main">
                <div className={`verdict-text ${isUpward ? 'bullish' : 'bearish'}`}>
                  {isUpward ? '▲ UPSIDE (LONG)' : '▼ DOWNSIDE (SHORT)'}
                </div>
                <div className="verdict-sub">Target Date: {forecastData.date} | Focus: Wall Street Open</div>
              </div>

              <div className="prob-metrics">
                <div className="prob-line">
                  <div className="prob-header">
                    <span>UPWARD VECTOR</span>
                    <span className="green">{(upwardProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="prob-track">
                    <div className="prob-fill green" style={{ width: `${upwardProb * 100}%` }}></div>
                  </div>
                </div>
                <div className="prob-line">
                  <div className="prob-header">
                    <span>DOWNWARD VECTOR</span>
                    <span className="red">{(downwardProb * 100).toFixed(1)}%</span>
                  </div>
                  <div className="prob-track">
                    <div className="prob-fill red" style={{ width: `${downwardProb * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {forecastData.market_data && (
            <div className="doc-section">
              <div className="section-title">II. Baseline Market Prices (USD)</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Prior Close</th>
                    <th>NYC Open</th>
                    <th>Prior High</th>
                    <th>Prior Low</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${forecastData.market_data.prev_close?.toLocaleString()}</td>
                    <td>${forecastData.market_data.ny_open_price?.toLocaleString()}</td>
                    <td>${forecastData.market_data.prev_high?.toLocaleString()}</td>
                    <td>${forecastData.market_data.prev_low?.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {forecastData.features && (
            <div className="doc-section">
              <div className="section-title">III. Derived Quantitative Metrics</div>
              <div className="features-list">
                {QUANT_METRICS_MAP.map((metric, i) => {
                  const rawVal = forecastData.features[metric.dataKey];
                  const numVal = parseFloat(rawVal);
                  return (
                    <div className="feature-cell" key={i}>
                      <div className="fc-label">{metric.title}</div>
                      <div className={`fc-val ${numVal > 0 ? 'pos' : numVal < 0 ? 'neg' : ''}`}>
                        {formatMetric(rawVal)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </main>
      )}

    </div>
  )
}
