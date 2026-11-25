import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore, fetchAll } from '../lib/store'
import { downloadJSON } from '../lib/finance'
import { loadDemo } from '../lib/demo'
import { Card, Field, Err } from '../components/ui'

const TBL_ORDER = ['categories', 'accounts', 'debts', 'recurring_items', 'gold_holdings', 'gold_prices', 'charity_plans', 'transactions']
const CONFLICT = { gold_prices: 'household_id,karat' }
const ACT = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' }
const TN = { transactions: 'عملية', accounts: 'حساب', debts: 'دين', gold_holdings: 'ذهب', recurring_items: 'التزام', categories: 'تصنيف' }

function Categories() {
  const s = useStore(); const [name, setName] = useState(''); const [kind, setKind] = useState('expense')
  async function add(e) { e.preventDefault(); if (!name.trim()) return; try { await s.db.insert('categories', { name: name.trim(), kind, sort: 99 }, 'categories'); setName('') } catch (e2) { s.toast(e2.message) } }
  const row = c => (
    <div className="plan" key={c.id}>
      <input className="inl" defaultValue={c.name} onBlur={e => e.target.value.trim() && e.target.value !== c.name && s.db.update('categories', c.id, { name: e.target.value.trim() }, 'categories')} />
      {c.kind === 'expense' && <input className="inl sm" inputMode="decimal" placeholder="ميزانية شهرية" defaultValue={c.monthly_budget ?? ''} onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (c.monthly_budget == null ? null : Number(c.monthly_budget))) s.db.update('categories', c.id, { monthly_budget: v }, 'categories') }} />}
      <button className="link" onClick={() => s.db.update('categories', c.id, { is_active: !c.is_active }, 'categories')}>{c.is_active ? 'إيقاف' : 'تفعيل'}</button>
    </div>)
  return (
    <Card title="التصنيفات والميزانيات">
      <form className="inline-form" onSubmit={add}>
        <select value={kind} onChange={e => setKind(e.target.value)}><option value="expense">مصروف</option><option value="income">دخل</option></select>
        <input placeholder="تصنيف جديد" value={name} onChange={e => setName(e.target.value)} /><button className="btn btn-dark small">إضافة</button>
      </form>
      <h4 className="sub-h">المصروفات</h4>{s.categories.filter(c => c.kind === 'expense').map(row)}
      <h4 className="sub-h">الدخل</h4>{s.categories.filter(c => c.kind === 'income').map(row)}
    </Card>)
}

function Backup() {
  const s = useStore(); const [busy, setBusy] = useState(false)
  async function exportAll() {
    setBusy(true)
    try {
      const data = {}
      for (const t of TBL_ORDER) data[t] = await fetchAll(t)
      downloadJSON(`family-finance-backup-${new Date().toISOString().slice(0, 10)}.json`, { app: 'family-finance', version: 1, exported_at: new Date().toISOString(), data })
    } catch (e) { s.toast(e.message) } finally { setBusy(false) }
  }
  async function restore(e) {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return
    try {
      const j = JSON.parse(await file.text())
      if (j.app !== 'family-finance') throw new Error('ملف غير صالح')
      if (!confirm('سيتم دمج بيانات النسخة (إضافة/تحديث بحسب المعرّف) فوق البيانات الحالية. متابعة؟')) return
      setBusy(true)
      for (const t of TBL_ORDER) {
        const rows = (j.data[t] || []).map(r => ({ ...r, household_id: s.household.id, created_by: r.created_by ? s.uid : r.created_by, updated_by: null }))
        if (t === 'gold_prices') rows.forEach(r => { r.updated_by = s.uid })
        for (let i = 0; i < rows.length; i += 400) {
          const { error } = await supabase.from(t).upsert(rows.slice(i, i + 400), { onConflict: CONFLICT[t] || 'id' })
          if (error) throw new Error(`${t}: ${error.message}`)
        }
      }
      await s.loadAll(); s.toast('تمت الاستعادة ✓')
    } catch (e2) { s.toast('فشلت الاستعادة: ' + e2.message) } finally { setBusy(false) }
  }
  return (
    <Card title="النسخ الاحتياطي">
      <p className="muted">نسخة كاملة بصيغة JSON (تشمل المحذوف ناعماً). احتفظ بها دورياً.</p>
      <div className="btn-row"><button className="btn btn-dark" disabled={busy} onClick={exportAll}>تنزيل نسخة احتياطية</button>
        <label className="btn btn-ghost">استعادة من ملف<input type="file" accept="application/json" hidden onChange={restore} /></label></div>
    </Card>)
}

function Activity() {
  const s = useStore(); const [rows, setRows] = useState(null)
  useEffect(() => { supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(60).then(({ data }) => setRows(data || [])) }, [])
  const label = r => { const d = r.new_data || r.old_data || {}; return d.description || d.name || d.person_name || (d.amount ? d.amount : '') }
  return (
    <Card title="سجل النشاط">
      {!rows ? <p className="muted">…</p> : rows.length === 0 ? <p className="muted">لا نشاط بعد</p> : (
        <div className="log">{rows.map(r => {
          const soft = r.action === 'UPDATE' && r.new_data?.deleted_at && !r.old_data?.deleted_at
          return <div key={r.id}><b>{r.actor_name || '—'}</b> {soft ? 'حذف' : ACT[r.action]} {TN[r.table_name]} <em>{String(label(r))}</em> <small className="muted">{new Date(r.changed_at).toLocaleString('ar-u-nu-latn')}</small></div>
        })}</div>)}
    </Card>)
}

export default function Settings() {
  const s = useStore()
  const [name, setName] = useState(s.me.display_name); const [hhName, setHh] = useState(s.household.name)
  const [pw, setPw] = useState(''); const [pwErr, setPwErr] = useState(''); const [invite, setInvite] = useState(''); const [busy, setBusy] = useState(false)
  const hasDemo = s.accounts.some(a => a.is_demo) || s.txs.some(t => t.is_demo)

  async function saveProfile() {
    try {
      const a = await supabase.from('members').update({ display_name: name.trim() }).eq('user_id', s.uid); if (a.error) throw a.error
      const b = await supabase.from('households').update({ name: hhName.trim() }).eq('id', s.household.id); if (b.error) throw b.error
      s.refresh('members'); s.toast('تم الحفظ ✓')
    } catch (e) { s.toast(e.message) }
  }
  async function makeInvite() {
    const { data, error } = await supabase.rpc('create_invite'); if (error) return s.toast(error.message)
    setInvite(`${location.origin}/?invite=${data}`)
  }
  async function changePw(e) {
    e.preventDefault(); setPwErr('')
    const { error } = await supabase.auth.updateUser({ password: pw }); if (error) return setPwErr(error.message)
    setPw(''); s.toast('تم تغيير كلمة المرور ✓')
  }
  async function demo(on) {
    setBusy(true)
    try {
      if (on) await loadDemo(s); else { if (!confirm('حذف كل البيانات التجريبية فقط؟ بياناتكم الحقيقية لا تتأثر.')) return; const { error } = await supabase.rpc('clear_demo_data'); if (error) throw error }
      await s.loadAll(); s.toast(on ? 'حُمّلت بيانات تجريبية' : 'حُذفت البيانات التجريبية')
    } catch (e) { s.toast(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div className="page-h"><h2>الإعدادات</h2></div>
      <Card title="الملف والعائلة">
        <div className="form">
          <Field label="اسمك"><input value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="اسم العائلة"><input value={hhName} onChange={e => setHh(e.target.value)} /></Field>
          <p className="muted small">العملة الأساسية: {s.base}. الحسابات بعملات أخرى تُعرض برصيدها لكن لا تدخل في إجمالي الثروة.</p>
          <div className="row-end"><button className="btn btn-green" onClick={saveProfile}>حفظ</button></div>
        </div>
      </Card>
      <Card title="الحسابات المرتبطة">
        {s.members.map(m => <div className="plan" key={m.user_id}><span>{m.display_name} — {m.role === 'husband' ? 'الزوج' : 'الزوجة'}{m.user_id === s.uid ? ' (أنت)' : ''}</span></div>)}
        {s.members.length < 2 && (<>
          <button className="btn btn-dark" onClick={makeInvite}>إنشاء رابط دعوة للزوج/الزوجة</button>
          {invite && <div className="invite"><input readOnly dir="ltr" value={invite} onFocus={e => e.target.select()} /><button className="btn btn-ghost small" onClick={() => { navigator.clipboard?.writeText(invite); s.toast('نُسخ الرابط') }}>نسخ</button><small className="muted">صالح 7 أيام ولمرة واحدة.</small></div>}
        </>)}
      </Card>
      <Categories />
      <Backup />
      <Card title="بيانات تجريبية">
        <p className="muted">للتجربة فقط. حذفها لا يمس بياناتكم الحقيقية.</p>
        <div className="btn-row"><button className="btn btn-ghost" disabled={busy || s.accounts.length > 0 && !hasDemo} onClick={() => demo(true)}>تحميل بيانات تجريبية</button>{hasDemo && <button className="btn btn-ghost danger" disabled={busy} onClick={() => demo(false)}>حذف البيانات التجريبية</button>}</div>
      </Card>
      <Card title="تغيير كلمة المرور">
        <form className="inline-form" onSubmit={changePw}><input type="password" minLength={6} required dir="ltr" placeholder="كلمة مرور جديدة" value={pw} onChange={e => setPw(e.target.value)} /><button className="btn btn-dark small">تغيير</button></form><Err text={pwErr} />
      </Card>
      <Activity />
      <button className="btn btn-ghost danger block" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
    </div>
  )
}
