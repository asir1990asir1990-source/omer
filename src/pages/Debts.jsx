import { useState } from 'react'
import { useStore } from '../lib/store'
import { parseAmount, todayStr, daysUntil } from '../lib/finance'
import { Money, Card, Modal, Field, Err, Empty, Seg } from '../components/ui'
import { TxList } from '../components/TxList'

function DebtForm({ dir, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ person_name: '', principal: '', debt_date: todayStr(), due_date: '', notes: '', account_id: '__none' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const given = dir === 'owed_to_us'
  async function submit(e) {
    e.preventDefault(); setErr('')
    const amount = parseAmount(f.principal)
    if (!(amount > 0)) return setErr('أدخل المبلغ')
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      await s.db.insert('debts', { id, direction: dir, person_name: f.person_name.trim(), principal: amount, debt_date: f.debt_date, due_date: f.due_date || null, notes: f.notes || null }, 'debts')
      if (f.account_id !== '__none') {
        await s.saveTx({ kind: given ? 'loan_given' : 'loan_received', amount, occurred_on: f.debt_date, account_id: f.account_id, debt_id: id, description: given ? `إقراض ${f.person_name}` : `اقتراض من ${f.person_name}`, owner: s.me.role })
      }
      s.toast('تم الحفظ ✓'); onClose()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={given ? 'دين جديد لنا عند شخص' : 'دين جديد علينا'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={given ? 'اسم المدين' : 'اسم الدائن'}><input required autoFocus value={f.person_name} onChange={e => set('person_name', e.target.value)} /></Field>
        <div className="grid2">
          <Field label="المبلغ الأصلي"><input inputMode="decimal" value={f.principal} onChange={e => set('principal', e.target.value)} /></Field>
          <Field label="تاريخ الدين"><input type="date" value={f.debt_date} onChange={e => set('debt_date', e.target.value)} /></Field>
        </div>
        <div className="grid2">
          <Field label="تاريخ السداد المتوقع"><input type="date" value={f.due_date} onChange={e => set('due_date', e.target.value)} /></Field>
          <Field label={given ? 'خرج المال من حساب' : 'دخل المال إلى حساب'} hint="القرض لا يُحسب دخلاً ولا مصروفاً">
            <select value={f.account_id} onChange={e => set('account_id', e.target.value)}>
              <option value="__none">دين قديم — بلا حركة نقدية الآن</option>
              {s.visibleAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="ملاحظات"><input value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <Err text={err} /><div className="row-end"><button className="btn btn-green" disabled={busy}>حفظ</button></div>
      </form>
    </Modal>
  )
}

export default function Debts() {
  const s = useStore(); const di = s.calc.di
  const [tab, setTab] = useState('owed_to_us'); const [form, setForm] = useState(false); const [open, setOpen] = useState(null)
  const list = s.debts.filter(d => d.direction === tab)
  const active = list.filter(d => di[d.id].remaining > 0), done = list.filter(d => di[d.id].remaining <= 0)
  const total = active.reduce((a, d) => a + di[d.id].remaining, 0)
  const given = tab === 'owed_to_us'

  function pay(d) {
    const rem = di[d.id].remaining
    s.openTx(given ? 'debt_collect' : 'debt_repay', { debt_id: d.id, amount: rem, description: `${given ? 'تحصيل من' : 'سداد إلى'} ${d.person_name}`, owner: s.me.role })
  }
  async function del(d) {
    if (!confirm('حذف هذا الدين من القائمة؟ تبقى العمليات المرتبطة به في السجل.')) return
    try { await s.db.softDelete('debts', d.id, 'debts'); setOpen(null) } catch (e) { s.toast(e.message) }
  }
  const card = d => {
    const x = di[d.id]; const pct = Math.min(100, x.paid / Number(d.principal) * 100)
    const dd = d.due_date ? daysUntil(d.due_date) : null
    return (
      <Card key={d.id}>
        <div className="acc-top"><b>{d.person_name}</b>{dd != null && x.remaining > 0 && <small className={dd < 0 ? 'neg' : 'muted'}>{dd < 0 ? `متأخر ${-dd} يوم` : dd === 0 ? 'يستحق اليوم' : `بعد ${dd} يوم`}</small>}</div>
        <Money v={x.remaining} className="acc-bal" tone={given ? 'pos' : 'neg'} />
        <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%', background: 'var(--green)' }} /></div>
        <small className="muted">الأصل <Money v={d.principal} /> · المسدّد <Money v={x.paid} /> · {d.debt_date}</small>
        {d.notes && <small className="muted">{d.notes}</small>}
        <div className="btn-row small">
          {x.remaining > 0 && <button className="btn btn-dark small" onClick={() => pay(d)}>{given ? 'تحصيل دفعة' : 'سداد دفعة'}</button>}
          <button className="link" onClick={() => setOpen(d)}>سجل الدفعات ({x.payments.length})</button>
        </div>
      </Card>
    )
  }
  return (
    <div className="stack">
      <div className="page-h"><h2>الديون</h2><button className="btn btn-green" onClick={() => setForm(true)}>+ دين جديد</button></div>
      <Seg value={tab} onChange={setTab} options={[['owed_to_us', 'لنا عند الآخرين'], ['we_owe', 'علينا للآخرين']]} />
      <Card><small className="muted">{given ? 'إجمالي المستحق لنا' : 'إجمالي المستحق علينا'}</small><div><Money v={total} tone={given ? 'pos' : 'neg'} className="big" /></div></Card>
      {list.length === 0 && <Empty text="لا توجد ديون في هذا القسم" />}
      <div className="grid-cards">{active.map(card)}</div>
      {done.length > 0 && <><h3 className="sub-h">مسدّدة بالكامل</h3><div className="grid-cards dim">{done.map(card)}</div></>}
      {form && <DebtForm dir={tab} onClose={() => setForm(false)} />}
      {open && (
        <Modal title={`دفعات ${open.person_name}`} onClose={() => setOpen(null)}>
          <TxList txs={s.txs.filter(t => t.debt_id === open.id)} onEdit={t => { setOpen(null); !t._pending && s.openTx(t.kind, t) }} empty="لا توجد حركات" />
          <div className="row-end"><button className="btn btn-ghost danger" onClick={() => del(open)}>حذف الدين</button></div>
        </Modal>
      )}
    </div>
  )
}
