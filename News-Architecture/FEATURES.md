# Market Intelligence Platform - Feature Registry

## Live Features

### Core Pipeline
- **Multi-source ingestion** — NewsAPI, RSS, GDELT with hash-based dedup
- **FinBERT sentiment analysis** — Local transformer model, -100 to +100 scoring
- **TF-IDF clustering** — Groups related articles automatically
- **Impact scoring** — Dynamic weights (optimized via grid search)
- **GPR Index** — Geopolitical risk 0-100 with trend detection

### Validation & Accuracy
- **Hindsight Validator** — Sentiment vs. SPY return backtesting
- **Weight optimizer** — Grid search across ~100 weight combinations
- **Weekly scorecard** — Letter-grade accuracy tracking (A-F)
- **Pearson & Spearman correlation** — Statistical validation

### Intelligence Features  
- **Today's Signal** — Single actionable sentence (rule-based)
- **Narrative threading** — Cross-day story tracking with AND matching
- **Entity sentiment tracker** — Per-entity sentiment over time
- **Volume anomaly detection** — Z-score alerts (>2σ)
- **Executive briefing** — Gemini Pro summary with local fallback

### Observability
- **Pipeline health monitor** — Per-step success/failure/duration tracking
- **7-day failure rate** — Calculated from pipeline_health table

### Dashboard Components
- `TodaySignal` — Actionable signal with sentiment badge
- `WeeklyScorecard` — Letter grade + accuracy + correlation
- `AnomalyBanner` — Volume spike alerts
- `GPRGauge` — Geopolitical risk visualization
- `IntelligenceDashboard` — Topic cluster map
- `EntityTimeline` — Entity sentiment over time
- `NarrativeTimeline` — Active/resolved story threads
- `HindsightValidator` — Backtest scatter plot + weight optimization
- `ExportBriefing` — PDF/email export

### Export
- **PDF briefing** — Printable HTML for browser PDF export
- **Email digest** — Via Resend API
- **Feedback CSV** — Exportable sentiment/impact feedback
