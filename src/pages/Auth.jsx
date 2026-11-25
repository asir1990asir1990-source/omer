import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Field, Err } from '../components/ui'

const ar = m => /Invalid login/i.test(m) ? 'البريد أو كلمة المرور غير صحيحة' : /already registered/i.test(m) ? 'هذا البريد مسجّل مسبقاً، سجّل الدخول' : /Password should/i.test(m) ? 'كلمة المرور قصيرة (6 أحرف على الأقل)' : /not confirmed/i.test(m) ? 'أكّد بريدك الإلكتروني من الرسالة التي وصلتك' : m

export default function Auth() {
  const [mode, setMode] = useState(new URLSearchParams(location.search).get('invite') ? 'up' : 'in')
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw }); if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: pw }); if (error) throw error
        if (!data.session) setInfo('أُرسلت رسالة تأكيد إلى بريدك. افتحها ثم عد لتسجيل الدخول.')
      }
    } catch (e2) { setErr(ar(e2.message)) } finally { setBusy(false) }
  }
  return (
    <div className="auth">
      <form className="auth-card form" onSubmit={submit}>
        <div className="logo-mark" aria-hidden="true">₺</div>
        <h1>مالية العائلة</h1>
        <p className="muted">{mode === 'in' ? 'سجّل الدخول لمتابعة أموالكما' : 'أنشئ حسابك (ثم أنشئ العائلة أو انضم بدعوة)'}</p>
        <Field label="البريد الإلكتروني"><input type="email" required autoComplete="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="كلمة المرور"><input type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} dir="ltr" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <Err text={err} />{info && <div className="ok-msg">{info}</div>}
        <button className="btn btn-green block" disabled={busy}>{busy ? '…' : mode === 'in' ? 'دخول' : 'إنشاء الحساب'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr('') }}>{mode === 'in' ? 'ليس لديك حساب؟ أنشئ حساباً' : 'لديك حساب؟ سجّل الدخول'}</button>
      </form>
    </div>
  )
}
