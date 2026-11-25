import { useState } from 'react'
import { useStore } from '../lib/store'
import { monthRange, parseAmount, todayStr, charityDue } from '../lib/finance'
import { Money, Card, Modal, Field, Err, Empty } from '../components/ui'
import { TxList } from '../components/TxList'

const CF = { daily: 'يومية', weekly: 'أسبوعية', monthly: 'شهرية', once: 'موسمية (مرة واحدة)' }

function PlanForm({ plan, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ label: plan?.label || '', target_amount: plan?.target_amount ?? '', frequency: plan?.frequency || 'weekly', remind_time: (plan?.remind_time || '20:00').slice(0, 5), remind_on: plan?.remind_on || '', message: plan?.message || '', is_active: plan?.is_active ?? true })
  const [err, setErr] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  async function submit(e) {
    e.preventDefault()
    if (f.frequency === 'once' && !f.remind_on) return setErr('حدّد تاريخ التذكير')
    try {
      const row = { ...f, target_amount: f.target_amount === '' ? null : parseAmount(f.target_amount), remind_on: f.frequency === 'once' ? f.remind_on : null, message: f.message || null }
      if (plan) await s.db.update('charity_plans', plan.id, row, 'charity'); else await s.db.insert('charity_plans', row, 'charity')
      onClose()
    } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal title={plan ? 'تعديل التذكير' : 'تذكير جديد'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="الاسم"><input required autoFocus value={f.label} onChange={e => set('label', e.target.value)} placeholder="صدقة الجمعة، زكاة المال، رمضان…" /></Field>
        <div className="grid2">
          <Field label="المبلغ المستهدف"><input inputMode="decimal" value={f.target_amount} onChange={e => set('target_amount', e.target.value)} /></Field>
          <Field label="الدورية"><select value={f.frequency} onChange={e => set('frequency', e.target.value)}>{Object.entries(CF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <div className="grid2">
          <Field label="وقت التذكير"><input type="time" value={f.remind_time} onChange={e => set('remind_time', e.target.value)} /></Field>
          {f.frequency === 'once' && <Field label="تاريخ التذكير"><input type="date" value={f.remind_on} onChange={e => set('remind_on', e.target.value)} /></Field>}
        </div>
        <Field label="رسالة التذكير (اختياري)"><input value={f.message} onChange={e => set('message', e.target.value)} placeholder="لا تنسَ أن تجعل لك نصيباً من الصدقة اليوم" /></Field>
        <p className="muted small">لا يحسب التطبيق مقدار الزكاة شرعياً؛ هو تذكير وتسجيل فقط.</p>
        <Err text={err} /><div className="row-end"><button className="btn btn-gold">حفظ</button></div>
      </form>
    </Modal>
  )
}

export default function Charity() {
  const s = useStore(); const [form, setForm] = useState(null)
  const ch = s.categories.find(c => c.system_key === 'charity')
  const all = s.txs.filter(t => t.kind === 'expense' && ch && t.category_id === ch.id)
  const m = monthRange(0), y = String(new Date().getFullYear())
  const sum = l => l.reduce((a, t) => a + Number(t.amount), 0)
  const mt = sum(all.filter(t => t.occurred_on >= m.from && t.occurred_on <= m.to)), yt = sum(all.filter(t => t.occurred_on.startsWith(y)))
  const due = new Set(charityDue(s.charity, s.txs, s.categories).map(p => p.id))
  const give = amount => s.openTx('expense', { amount: amount || '', description: 'صدقة', category_id: ch?.id, owner: s.me.role, beneficiary: 'shared' })
  return (
    <div className="stack">
      <div className="page-h"><h2>الصدقات والتبرعات</h2><button className="btn btn-gold" onClick={() => give()}>🤲 تسجيل صدقة</button></div>
      <div className="grid2">
        <Card><small className="muted">هذا الشهر</small><div><Money v={mt} className="big" /></div></Card>
        <Card><small className="muted">هذه السنة</small><div><Money v={yt} className="big" /></div></Card>
      </div>
      <Card title="التذكيرات" action={<button className="link" onClick={() => setForm({})}>+ تذكير</button>}>
        {s.charity.length === 0 ? <Empty text="أضف تذكيراً أسبوعياً أو موسمياً" /> : s.charity.map(p => (
          <div key={p.id} className="plan">
            <div><b>{p.label}</b>{due.has(p.id) && <em className="tag warn">حان الموعد</em>}<br /><small className="muted">{CF[p.frequency]} · {String(p.remind_time).slice(0, 5)}{p.remind_on ? ' · ' + p.remind_on : ''}{p.target_amount ? ' · الهدف ' + Number(p.target_amount) : ''}{!p.is_active ? ' · متوقف' : ''}</small></div>
            <div className="btn-row small">
              <button className="btn btn-dark small" onClick={() => give(p.target_amount)}>سجّل</button>
              <button className="link" onClick={() => setForm(p)}>تعديل</button>
              <button className="link danger" onClick={async () => confirm('حذف التذكير؟') && s.db.remove('charity_plans', p.id, 'charity')}>حذف</button>
            </div>
          </div>))}
      </Card>
      <Card title="سجل الصدقات"><TxList txs={all.slice(0, 30)} onEdit={t => !t._pending && s.openTx(t.kind, t)} empty="لا توجد صدقات مسجّلة بعد" /></Card>
      {form && <PlanForm plan={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  )
}
