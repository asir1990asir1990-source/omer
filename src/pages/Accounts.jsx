import { useState } from 'react'
import { useStore } from '../lib/store'
import { ACC_TYPES, CURRENCIES, parseAmount, todayStr } from '../lib/finance'
import { Money, Card, Modal, Field, Err, Empty } from '../components/ui'

function AccountForm({ acc, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ name: acc?.name || '', type: acc?.type || 'bank', owner: acc?.owner || 'shared', opening_balance: acc?.opening_balance ?? '', currency: acc?.currency || s.base, notes: acc?.notes || '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const row = { ...f, name: f.name.trim(), opening_balance: f.opening_balance === '' ? 0 : parseAmount(f.opening_balance) }
      if (acc) await s.db.update('accounts', acc.id, row, 'accounts'); else await s.db.insert('accounts', row, 'accounts')
      s.toast('تم الحفظ ✓'); onClose()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={acc ? 'تعديل الحساب' : 'إضافة حساب'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="اسم الحساب"><input required autoFocus value={f.name} onChange={e => set('name', e.target.value)} placeholder="Papara، Vakıf Katılım، نقداً…" /></Field>
        <div className="grid2">
          <Field label="النوع"><select value={f.type} onChange={e => set('type', e.target.value)}>{Object.entries(ACC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="المسؤول"><select value={f.owner} onChange={e => set('owner', e.target.value)}><option value="husband">{s.nameOf('husband')}</option><option value="wife">{s.nameOf('wife')}</option><option value="shared">مشترك</option></select></Field>
        </div>
        <div className="grid2">
          <Field label="الرصيد الافتتاحي" hint="الرصيد الحالي = الافتتاحي + الحركات"><input inputMode="decimal" value={f.opening_balance} onChange={e => set('opening_balance', e.target.value)} placeholder="0" /></Field>
          <Field label="العملة"><select value={f.currency} onChange={e => set('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="ملاحظات"><input value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <Err text={err} /><div className="row-end"><button className="btn btn-green" disabled={busy}>حفظ</button></div>
      </form>
    </Modal>
  )
}

function AdjustForm({ acc, balance, onClose }) {
  const s = useStore()
  const [actual, setActual] = useState(''); const [reason, setReason] = useState(''); const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    const diff = Math.round((parseAmount(actual) - balance) * 100) / 100
    if (actual === '') return setErr('أدخل الرصيد الفعلي')
    if (diff === 0) return setErr('الرصيد مطابق، لا حاجة للتسوية')
    if (!reason.trim()) return setErr('سبب التسوية مطلوب')
    try {
      await s.saveTx({ kind: diff > 0 ? 'adjust_in' : 'adjust_out', amount: Math.abs(diff), occurred_on: todayStr(), account_id: acc.id, description: 'تسوية رصيد', notes: reason.trim(), owner: 'shared' })
      s.toast('سُجّلت التسوية ✓'); onClose()
    } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal title={`تسوية رصيد «${acc.name}»`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">الرصيد المسجّل الآن: <Money v={balance} cur={acc.currency} />. أدخل الرصيد الفعلي، وسنسجّل الفرق كتسوية موثّقة (لا تُحسب دخلاً ولا مصروفاً).</p>
        <Field label="الرصيد الفعلي"><input inputMode="decimal" autoFocus value={actual} onChange={e => setActual(e.target.value)} /></Field>
        <Field label="سبب التسوية"><input value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: مطابقة مع كشف البنك" /></Field>
        <Err text={err} /><div className="row-end"><button className="btn btn-dark">تسجيل التسوية</button></div>
      </form>
    </Modal>
  )
}

export default function Accounts() {
  const s = useStore(); const c = s.calc
  const [form, setForm] = useState(null); const [adj, setAdj] = useState(null); const [showHidden, setShowHidden] = useState(false)
  const list = s.accounts.filter(a => showHidden || !a.is_hidden)
  const hiddenCount = s.accounts.filter(a => a.is_hidden).length

  async function remove(a) {
    if (!confirm(`حذف «${a.name}»؟ إن كانت عليه عمليات سيُخفى بدل الحذف للحفاظ على السجلات.`)) return
    try { await s.db.remove('accounts', a.id, 'accounts'); s.toast('تم الحذف') }
    catch { await s.db.update('accounts', a.id, { is_hidden: true }, 'accounts'); s.toast('عليه عمليات، فتم إخفاؤه') }
  }
  return (
    <div className="stack">
      <div className="page-h">
        <div><h2>الحسابات والأموال</h2><p className="muted">سيولة: <Money v={c.liquid} /></p></div>
        <div className="btn-row">
          <button className="btn btn-dark" onClick={() => s.openTx('transfer')} disabled={s.visibleAccounts.length < 2}>⇄ تحويل</button>
          <button className="btn btn-green" onClick={() => setForm({})}>+ حساب</button>
        </div>
      </div>
      {list.length === 0 && <Empty text="أضف أول حساب (Papara، بنك، نقد…) وحدّد رصيده الافتتاحي." action={<button className="btn btn-green" onClick={() => setForm({})}>+ إضافة حساب</button>} />}
      <div className="grid-cards">
        {list.map(a => (
          <Card key={a.id} className={a.is_hidden ? 'dim' : ''}>
            <div className="acc-top"><div><b>{a.name}</b><small className="muted"> {ACC_TYPES[a.type]} · {s.nameOf(a.owner)}</small></div></div>
            <Money v={c.bal[a.id]} cur={a.currency} tone={c.bal[a.id] < 0 ? 'neg' : ''} className="acc-bal" />
            {a.currency !== s.base && <small className="muted">لا يدخل في إجمالي {s.base}</small>}
            {a.notes && <small className="muted">{a.notes}</small>}
            <div className="btn-row small">
              <button className="link" onClick={() => setForm(a)}>تعديل</button>
              <button className="link" onClick={() => setAdj(a)}>تسوية</button>
              <button className="link" onClick={() => s.db.update('accounts', a.id, { is_hidden: !a.is_hidden }, 'accounts')}>{a.is_hidden ? 'إظهار' : 'إخفاء'}</button>
              <button className="link danger" onClick={() => remove(a)}>حذف</button>
            </div>
          </Card>
        ))}
      </div>
      {hiddenCount > 0 && <button className="link" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'إخفاء' : 'عرض'} الحسابات المخفية ({hiddenCount})</button>}
      {form && <AccountForm acc={form.id ? form : null} onClose={() => setForm(null)} />}
      {adj && <AdjustForm acc={adj} balance={c.bal[adj.id]} onClose={() => setAdj(null)} />}
    </div>
  )
}
