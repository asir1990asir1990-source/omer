import { useState } from 'react'
import { useStore } from '../lib/store'
import { Modal, Field, Err } from './ui'
import { parseAmount, todayStr } from '../lib/finance'

const TITLES = { income: 'إضافة دخل', expense: 'إضافة مصروف', transfer: 'تحويل بين الحسابات', debt_repay: 'تسجيل سداد', debt_collect: 'تسجيل تحصيل' }

export default function TxForm({ kind: k0, initial, onClose, onSaved }) {
  const s = useStore()
  const editing = Boolean(initial?.id)
  const kind = initial?.kind || k0
  const last = localStorage.getItem('ff_last_acc')
  const [f, setF] = useState(() => ({
    amount: initial?.amount ?? '', description: initial?.description ?? '', category_id: initial?.category_id ?? '',
    account_id: initial?.account_id || s.visibleAccounts.find(a => a.id === last)?.id || s.visibleAccounts[0]?.id || '',
    to_account_id: initial?.to_account_id || '', owner: initial?.owner || s.me.role,
    beneficiary: initial?.beneficiary || 'shared', occurred_on: initial?.occurred_on || todayStr(), notes: initial?.notes ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const accs = s.accounts.filter(a => !a.is_hidden || a.id === f.account_id || a.id === f.to_account_id)
  const cats = s.categories.filter(c => c.kind === kind && (c.is_active || c.id === f.category_id))
  const owners = [['husband', s.nameOf('husband')], ['wife', s.nameOf('wife')], ['shared', 'مشترك']]
  const isMain = kind === 'income' || kind === 'expense'
  const accOpts = accs.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)

  async function submit(e) {
    e.preventDefault(); setErr('')
    const amount = parseAmount(f.amount)
    if (!(amount > 0)) return setErr('أدخل مبلغاً صحيحاً أكبر من صفر')
    if (!f.account_id) return setErr('اختر الحساب — أضف حساباً أولاً من صفحة الحسابات')
    if (kind === 'transfer' && (!f.to_account_id || f.to_account_id === f.account_id)) return setErr('اختر حسابين مختلفين للتحويل')
    const row = {
      kind, amount, occurred_on: f.occurred_on, account_id: f.account_id,
      to_account_id: kind === 'transfer' ? f.to_account_id : null,
      category_id: isMain ? (f.category_id || null) : (initial?.category_id || null),
      debt_id: initial?.debt_id || null, recurring_id: initial?.recurring_id || null,
      description: f.description || null, notes: f.notes || null,
      owner: f.owner, beneficiary: kind === 'expense' ? f.beneficiary : null,
    }
    setBusy(true)
    try {
      const res = await s.saveTx(row, editing ? initial.id : undefined)
      localStorage.setItem('ff_last_acc', f.account_id)
      s.toast(res.queued ? 'حُفظت على الجهاز وستُرسل عند عودة الاتصال' : 'تم الحفظ ✓')
      onSaved?.(row); onClose()
    } catch (e2) { setErr(e2.message || 'تعذّر الحفظ') } finally { setBusy(false) }
  }

  async function del() {
    if (!confirm('حذف هذه العملية؟ سيُعاد احتساب الرصيد تلقائياً، ويبقى الحذف مسجلاً في سجل النشاط.')) return
    setBusy(true)
    try { await s.removeTx(initial); s.toast('تم الحذف'); onClose() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const btn = kind === 'income' ? 'btn-green' : kind === 'expense' ? 'btn-red' : 'btn-dark'
  return (
    <Modal title={editing ? 'تعديل العملية' : TITLES[kind]} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <input className="amount-in" inputMode="decimal" autoFocus={!editing} placeholder="0.00" value={f.amount} onChange={e => set('amount', e.target.value)} aria-label="المبلغ" />
        {kind !== 'transfer' && <Field label={isMain ? 'الوصف' : 'ملاحظة قصيرة'}><input value={f.description} onChange={e => set('description', e.target.value)} placeholder={kind === 'expense' ? 'مثال: خضار وفواكه' : kind === 'income' ? 'مثال: راتب تشرين الثاني' : ''} /></Field>}
        {isMain && (
          <div className="field"><span>التصنيف</span>
            <div className="chips">{cats.map(c => <button type="button" key={c.id} className={`chip ${f.category_id === c.id ? 'on' : ''}`} onClick={() => set('category_id', f.category_id === c.id ? '' : c.id)}>{c.icon} {c.name}</button>)}</div>
          </div>
        )}
        <div className="grid2">
          <Field label={kind === 'transfer' ? 'من حساب' : kind === 'income' ? 'أُودع في حساب' : kind === 'expense' ? 'خرج من حساب' : 'الحساب'}>
            <select value={f.account_id} onChange={e => set('account_id', e.target.value)}>{accOpts}</select>
          </Field>
          {kind === 'transfer'
            ? <Field label="إلى حساب"><select value={f.to_account_id} onChange={e => set('to_account_id', e.target.value)}><option value="">اختر…</option>{accs.filter(a => a.id !== f.account_id).map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></Field>
            : <Field label="التاريخ"><input type="date" value={f.occurred_on} onChange={e => set('occurred_on', e.target.value)} /></Field>}
        </div>
        {kind === 'transfer' && <Field label="التاريخ"><input type="date" value={f.occurred_on} onChange={e => set('occurred_on', e.target.value)} /></Field>}
        {kind !== 'transfer' && (
          <div className="grid2">
            <Field label={kind === 'income' ? 'يعود إلى' : kind === 'expense' ? 'من قام بالمصروف' : 'منسوبة إلى'}>
              <select value={f.owner} onChange={e => set('owner', e.target.value)}>{owners.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            {kind === 'expense' && <Field label="المستفيد"><select value={f.beneficiary} onChange={e => set('beneficiary', e.target.value)}>{owners.map(([v, l]) => <option key={v} value={v}>{v === 'shared' ? 'الأسرة' : l}</option>)}</select></Field>}
          </div>
        )}
        <Field label="ملاحظات (اختياري)"><input value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        {editing && <p className="muted small">أُضيفت بواسطة {s.userName(initial.created_by)}{initial.updated_by && initial.updated_at !== initial.created_at ? ` · آخر تعديل بواسطة ${s.userName(initial.updated_by)} في ${new Date(initial.updated_at).toLocaleString('ar-u-nu-latn')}` : ''}</p>}
        <Err text={err} />
        <div className="row-end">
          {editing && <button type="button" className="btn btn-ghost danger" onClick={del} disabled={busy}>حذف</button>}
          <button className={`btn ${btn}`} disabled={busy}>{busy ? '…' : 'حفظ'}</button>
        </div>
      </form>
    </Modal>
  )
}
