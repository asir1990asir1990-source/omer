import { useEffect } from 'react'

export const PALETTE = ['#1f8a5b', '#c8433f', '#b8892b', '#3a6ea5', '#7b5ea7', '#d9822b', '#2a9d8f', '#8d99ae', '#e07a8a', '#5c7a29']
const SYM = { TRY: '₺', USD: '$', EUR: '€' }
export const fmtNum = (n, d = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(Math.round((Number(n) || 0) * 100) / 100)

export function Money({ v, cur = 'TRY', plus = false, tone = '', className = '' }) {
  const n = Number(v) || 0
  const cls = tone === 'auto' ? (n > 0 ? 'pos' : n < 0 ? 'neg' : '') : tone
  return <span className={`num ${cls} ${className}`} dir="ltr">{plus && n > 0 ? '+' : ''}{fmtNum(n)} {SYM[cur] || cur}</span>
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-h"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="إغلاق">✕</button></div>
        <div className="sheet-b">{children}</div>
      </div>
    </div>
  )
}

export const Field = ({ label, children, hint }) => <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
export const Card = ({ title, action, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || action) && <div className="card-h"><h3>{title}</h3>{action}</div>}
    {children}
  </section>
)
export const Empty = ({ text, action }) => <div className="empty"><p>{text}</p>{action}</div>
export const Err = ({ text }) => text ? <div className="err" role="alert">{text}</div> : null

export function Seg({ value, onChange, options }) {
  return <div className="seg" role="tablist">{options.map(([v, l]) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>
}

export function Donut({ data, center }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  if (!total) return <Empty text="لا توجد بيانات بعد" />
  let off = 25
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42" width="160" height="160" aria-hidden="true">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#ece9df" strokeWidth="5.5" />
        {data.map((d, i) => {
          const p = d.value / total * 100
          const el = <circle key={i} cx="21" cy="21" r="15.9155" fill="none" stroke={d.color || PALETTE[i % PALETTE.length]} strokeWidth="5.5" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={off} />
          off -= p
          return el
        })}
      </svg>
      <div className="donut-c">{center}</div>
    </div>
  )
}

export function Bars({ rows, color }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <button key={i} type="button" className="bar-row" onClick={r.onClick} disabled={!r.onClick}>
          <div className="bar-top"><span>{r.icon} {r.label}</span><Money v={r.value} /></div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(2, r.value / max * 100)}%`, background: r.color || color || PALETTE[i % PALETTE.length] }} /></div>
          {r.sub && <small className={r.subTone || ''}>{r.sub}</small>}
        </button>
      ))}
    </div>
  )
}

export function Line({ values, labels, color = '#1f8a5b' }) {
  if (values.length < 2) return <Empty text="لا توجد بيانات كافية" />
  const W = 300, H = 110, P = 8
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1
  const pts = values.map((v, i) => [P + i * (W - 2 * P) / (values.length - 1), H - P - (v - mn) / rng * (H - 2 * P)])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="line" aria-hidden="true">
        <path d={`${d} L${pts.at(-1)[0]} ${H} L${pts[0][0]} ${H} Z`} fill={color} opacity=".1" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={color} />)}
      </svg>
      <div className="line-labels"><span>{labels[0]}</span><span>{labels.at(-1)}</span></div>
    </div>
  )
}
