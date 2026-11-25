import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Field, Err, Seg } from '../components/ui'

export default function Onboarding() {
  const s = useStore()
  const code0 = new URLSearchParams(location.search).get('invite') || ''
  const [mode, setMode] = useState(code0 ? 'join' : 'create')
  const [name, setName] = useState(''); const [hh, setHh] = useState('عائلتنا'); const [code, setCode] = useState(code0)
  const [role, setRole] = useState('husband'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  async function go(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const { error } = mode === 'create'
        ? await supabase.rpc('create_household', { p_name: hh, p_display: name.trim(), p_role: role })
        : await supabase.rpc('join_household', { p_code: code, p_display: name.trim(), p_role: role })
      if (error) throw error
      history.replaceState({}, '', location.pathname)
      await s.loadAll()
    } catch (e2) { setErr(/duplicate|unique/i.test(e2.message) ? 'هذا الدور (زوج/زوجة) مأخوذ في العائلة. اختر الدور الآخر.' : e2.message) } finally { setBusy(false) }
  }
  return (
    <div className="auth">
      <form className="auth-card form" onSubmit={go}>
        <h1>أهلاً بكما</h1>
        <Seg value={mode} onChange={setMode} options={[['create', 'إنشاء مساحة العائلة'], ['join', 'الانضمام بدعوة']]} />
        <Field label="اسمك"><input required value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="أنت"><select value={role} onChange={e => setRole(e.target.value)}><option value="husband">الزوج</option><option value="wife">الزوجة</option></select></Field>
        {mode === 'create'
          ? <Field label="اسم العائلة"><input value={hh} onChange={e => setHh(e.target.value)} /></Field>
          : <Field label="رمز الدعوة"><input required dir="ltr" value={code} onChange={e => setCode(e.target.value)} /></Field>}
        <Err text={err} />
        <button className="btn btn-green block" disabled={busy}>{busy ? '…' : mode === 'create' ? 'إنشاء' : 'انضمام'}</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
      </form>
    </div>
  )
}
