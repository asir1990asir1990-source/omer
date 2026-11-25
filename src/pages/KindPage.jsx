import { useState } from 'react'
import { useStore } from '../lib/store'
import { monthRange, summarize, inRange } from '../lib/finance'
import { Money, Card, Bars } from '../components/ui'
import { TxList } from '../components/TxList'

export default function KindPage({ kind }) {
  const s = useStore()
  const [off, setOff] = useState(0)
  const r = monthRange(off)
  const txs = s.txs.filter(t => t.kind === kind && inRange(t, r))
  const m = summarize(txs)
  const total = kind === 'income' ? m.income : m.expense
  const by = kind === 'income' ? m.incomeBy : m.expenseBy
  const catMap = kind === 'income' ? m.incomeCat : m.cat
  const rows = Object.entries(catMap).map(([id, v]) => {
    const c = s.catOf(id); const budget = Number(c?.monthly_budget) || 0
    const p = budget ? v / budget : 0
    return { label: id === 'none' ? 'بدون تصنيف' : c?.name, icon: c?.icon, value: v, color: kind === 'income' ? 'var(--green)' : p >= 1 ? 'var(--red)' : undefined,
      sub: budget ? `الميزانية ${Math.round(budget)} — ${Math.round(p * 100)}%` : '', subTone: p >= 1 ? 'neg' : '' }
  }).sort((a, b) => b.value - a.value)
  const isIn = kind === 'income'

  return (
    <div className="stack">
      <div className="page-h">
        <h2>{isIn ? 'الدخل' : 'المصروفات'}</h2>
        <button className={`btn ${isIn ? 'btn-green' : 'btn-red'}`} onClick={() => s.openTx(kind)}>{isIn ? '+ إضافة دخل' : '− إضافة مصروف'}</button>
      </div>
      <div className="month-nav">
        <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="الشهر السابق">›</button>
        <b>{r.label}</b>
        <button className="icon-btn" onClick={() => setOff(Math.min(0, off + 1))} disabled={off === 0} aria-label="الشهر التالي">‹</button>
      </div>
      <Card>
        <small className="muted">{isIn ? 'إجمالي الدخل' : 'إجمالي المصروفات'}</small>
        <div><Money v={total} tone={isIn ? 'pos' : 'neg'} className="big" /></div>
        <div className="kv">
          <span>{s.nameOf('husband')}</span><Money v={by.husband} />
          <span>{s.nameOf('wife')}</span><Money v={by.wife} />
          <span>مشترك</span><Money v={by.shared} />
        </div>
      </Card>
      {rows.length > 0 && <Card title="حسب التصنيف"><Bars rows={rows} /></Card>}
      <Card title="العمليات">
        <TxList txs={txs} onEdit={t => t._pending ? s.toast('بانتظار المزامنة') : s.openTx(t.kind, t)} empty={isIn ? 'لا يوجد دخل مسجّل في هذا الشهر' : 'لا توجد مصروفات في هذا الشهر'} />
      </Card>
    </div>
  )
}
