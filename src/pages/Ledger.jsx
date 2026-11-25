import { useState } from 'react'
import { useStore } from '../lib/store'
import { KIND_LABEL } from '../lib/finance'
import { TxList } from '../components/TxList'
import { Card } from '../components/ui'

export default function Ledger() {
  const s = useStore()
  const [q, setQ] = useState(''); const [kind, setKind] = useState(''); const [acc, setAcc] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [limit, setLimit] = useState(100)
  const needle = q.trim().toLowerCase()
  const list = s.txs.filter(t => {
    if (kind && t.kind !== kind) return false
    if (acc && t.account_id !== acc && t.to_account_id !== acc) return false
    if (from && t.occurred_on < from) return false
    if (to && t.occurred_on > to) return false
    if (!needle) return true
    return [t.description, t.notes, s.catOf(t.category_id)?.name, s.nameOf(t.owner), s.userName(t.created_by), String(t.amount)].some(x => String(x || '').toLowerCase().includes(needle))
  })
  return (
    <div className="stack">
      <div className="page-h"><div><h2>سجل العمليات</h2><p className="muted">{list.length} عملية</p></div></div>
      <Card>
        <div className="form">
          <input type="search" placeholder="بحث بالاسم أو الشخص أو المبلغ…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="grid2">
            <select value={kind} onChange={e => setKind(e.target.value)}><option value="">كل الأنواع</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={acc} onChange={e => setAcc(e.target.value)}><option value="">كل الحسابات</option>{s.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </div>
          <div className="grid2"><input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="من تاريخ" /><input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="إلى تاريخ" /></div>
        </div>
      </Card>
      <Card>
        <TxList txs={list.slice(0, limit)} onEdit={t => t._pending ? s.toast('بانتظار المزامنة، ستظهر للتعديل بعد الإرسال') : s.openTx(t.kind, t)} empty="لا توجد نتائج" />
        {list.length > limit && <button className="btn btn-ghost block" onClick={() => setLimit(limit + 100)}>عرض المزيد</button>}
      </Card>
    </div>
  )
}
