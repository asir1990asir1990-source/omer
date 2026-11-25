import { useState } from 'react'
import { useStore } from '../lib/store'
import { FREQ, parseAmount, todayStr, addFreq, daysUntil } from '../lib/finance'
import { Money, Card, Modal, Field, Err, Empty } from '../components/ui'

function Form({ item, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ name: item?.name || '', amount: item?.amount ?? '', frequency: item?.frequency || 'monthly', custom_days: item?.custom_days || 30, next_due: item?.next_due || todayStr(), account_id: item?.account_id || s.visibleAccounts[0]?.id || '', category_id: item?.category_id || '', owner: item?.owner || 'shared', remind: item?.remind ?? true, is_active: item?.is_active ?? true })
  const [err, setErr] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  async function submit(e) {
    e.preventDefault()
    const amount = parseAmount(f.amount); if (!(amount > 0)) return setErr('أدخل المبلغ المتوقع')
    try {
      const row = { ...f, name: f.name.trim(), amount, custom_days: f.frequency === 'custom' ? Number(f.custom_days) : null, account_id: f.account_id || null, category_id: f.category_id || null }
      if (item) await s.db.update('recurring_items', item.id, row, 'recurring'); else await s.db.insert('recurring_items', row, 'recurring')
      s.toast('تم الحفظ ✓'); onClose()
    } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal title={item ? 'تعديل الالتزام' : 'التزام جديد'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="الاسم"><input required autoFocus value={f.name} onChange={e => set('name', e.target.value)} placeholder="الإيجار، الإنترنت، الكهرباء…" /></Field>
        <div className="grid2">
          <Field label="المبلغ المتوقع"><input inputMode="decimal" value={f.amount} onChange={e => set('amount', e.target.value)} /></Field>
          <Field label="الدورية"><select value={f.frequency} onChange={e => set('frequency', e.target.value)}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        {f.frequency === 'custom' && <Field label="كل كم يوم؟"><input type="number" min="1" value={f.custom_days} onChange={e => set('custom_days', e.target.value)} /></Field>}
        <div className="grid2">
          <Field label="تاريخ الاستحقاق القادم"><input type="date" value={f.next_due} onChange={e => set('next_due', e.target.value)} /></Field>
          <Field label="يُدفع من حساب"><select value={f.account_id} onChange={e => set('account_id', e.target.value)}><option value="">—</option>{s.visibleAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        </div>
        <div className="grid2">
          <Field label="المسؤول عن الدفع"><select value={f.owner} onChange={e => set('owner', e.target.value)}><option value="husband">{s.nameOf('husband')}</option><option value="wife">{s.nameOf('wife')}</option><option value="shared">مشترك</option></select></Field>
          <Field label="التصنيف"><select value={f.category_id} onChange={e => set('category_id', e.target.value)}><option value="">—</option>{s.categories.filter(c => c.kind === 'expense').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.remind} onChange={e => set('remind', e.target.checked)} /> تذكير في الصفحة الرئيسية</label>
        <p className="muted small">لا يُسجَّل أي مصروف تلقائياً: تضغط «تأكيد الدفع» عند الدفع فعلاً.</p>
        <Err text={err} /><div className="row-end"><button className="btn btn-green">حفظ</button></div>
      </form>
    </Modal>
  )
}

export default function Recurring() {
  const s = useStore(); const [form, setForm] = useState(null)
  const items = [...s.recurring].sort((a, b) => a.next_due.localeCompare(b.next_due))
  function pay(r) {
    s.openTx('expense', { amount: r.amount, description: r.name, account_id: r.account_id, category_id: r.category_id, owner: r.owner, beneficiary: 'shared', recurring_id: r.id }, async () => {
      try { await s.db.update('recurring_items', r.id, { next_due: addFreq(r.next_due, r.frequency, r.custom_days), last_paid_on: todayStr() }, 'recurring') } catch (e) { s.toast(e.message) }
    })
  }
  async function del(r) { if (confirm('حذف الالتزام؟ تبقى المصروفات المسجّلة سابقاً.')) { try { await s.db.remove('recurring_items', r.id, 'recurring') } catch { await s.db.update('recurring_items', r.id, { is_active: false }, 'recurring'); s.toast('له مصروفات سابقة، فتم إيقافه') } } }
  return (
    <div className="stack">
      <div className="page-h"><h2>الالتزامات الثابتة</h2><button className="btn btn-green" onClick={() => setForm({})}>+ التزام</button></div>
      {items.length === 0 && <Empty text="أضف الإيجار والفواتير والاشتراكات لتصلكم تنبيهات الاستحقاق." />}
      <div className="grid-cards">
        {items.map(r => {
          const d = daysUntil(r.next_due)
          return (
            <Card key={r.id} className={r.is_active ? '' : 'dim'}>
              <div className="acc-top"><b>{r.name}</b><small className={d < 0 ? 'neg' : d <= 3 ? 'warn-t' : 'muted'}>{d < 0 ? `متأخر ${-d} يوم` : d === 0 ? 'اليوم' : `بعد ${d} يوم`}</small></div>
              <Money v={r.amount} className="acc-bal" />
              <small className="muted">{FREQ[r.frequency]} · الاستحقاق {r.next_due} · {s.nameOf(r.owner)}{r.account_id ? ' · ' + s.accName(r.account_id) : ''}</small>
              {r.last_paid_on && <small className="muted">آخر دفعة: {r.last_paid_on}</small>}
              <div className="btn-row small">
                {r.is_active && <button className="btn btn-red small" onClick={() => pay(r)}>تأكيد الدفع</button>}
                <button className="link" onClick={() => setForm(r)}>تعديل</button>
                <button className="link danger" onClick={() => del(r)}>حذف</button>
              </div>
            </Card>
          )
        })}
      </div>
      {form && <Form item={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  )
}
