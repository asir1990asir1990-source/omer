import { useEffect, useState } from 'react'
import { supabase, configured } from './lib/supabase'
import { StoreProvider, useStore } from './lib/store'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import KindPage from './pages/KindPage'
import Gold from './pages/Gold'
import Debts from './pages/Debts'
import Recurring from './pages/Recurring'
import Charity from './pages/Charity'
import Reports from './pages/Reports'
import Ledger from './pages/Ledger'
import Settings from './pages/Settings'
import TxForm from './components/TxForm'

const NAV = [
  ['home', 'الرئيسية', '🏠'], ['accounts', 'الحسابات والأموال', '🏦'], ['income', 'الدخل', '⬇️'], ['expenses', 'المصروفات', '⬆️'],
  ['gold', 'الذهب والمدخرات', '🪙'], ['debts', 'الديون', '🤝'], ['recurring', 'الالتزامات الثابتة', '🗓️'], ['charity', 'الصدقات', '🤲'],
  ['reports', 'التقارير', '📊'], ['ledger', 'سجل العمليات', '📒'], ['settings', 'الإعدادات', '⚙️'],
]
const MOBILE = ['home', 'accounts', 'reports']

const Splash = ({ text = 'جارٍ التحميل…' }) => <div className="auth"><p className="muted">{text}</p></div>

function Setup() {
  return <div className="auth"><div className="auth-card form"><h1>إعداد مطلوب</h1><p>لم يتم ضبط متغيرات Supabase. أنشئ ملف <code>.env</code> (أو أضف المتغيرات في Vercel) بالقيمتين:</p><pre dir="ltr">VITE_SUPABASE_URL=…{'\n'}VITE_SUPABASE_ANON_KEY=…</pre><p className="muted">الخطوات الكاملة في README.</p></div></div>
}

function SyncBadge() {
  const s = useStore()
  const failed = s.pending.filter(p => p.error).length, wait = s.pending.length - failed
  if (s.online && !wait && !failed) return null
  return (
    <div className={`sync ${failed ? 'bad' : ''}`}>
      {!s.online && <span>⚠️ لا يوجد اتصال — ما تضيفونه يُحفظ على الجهاز</span>}
      {wait > 0 && <span>⏳ {wait} بانتظار المزامنة</span>}
      {failed > 0 && <button onClick={() => confirm('حذف العمليات المرفوضة من الطابور؟') && s.discardFailed()}>تعذّرت مزامنة {failed} — إزالة</button>}
    </div>
  )
}

function Shell() {
  const s = useStore()
  const [page, setPage] = useState(location.hash.slice(1) || 'home')
  const [more, setMore] = useState(false)
  useEffect(() => { const h = () => { setPage(location.hash.slice(1) || 'home'); window.scrollTo(0, 0) }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  const go = p => { location.hash = p; setMore(false) }

  if (s.loading) return <Splash />
  if (s.error) return <div className="auth"><div className="auth-card form"><h1>تعذّر التحميل</h1><p className="err">{s.error}</p><p className="muted small">تأكد من تشغيل ملف schema.sql في Supabase.</p><button className="btn btn-green" onClick={() => location.reload()}>إعادة المحاولة</button></div></div>
  if (!s.me) return <Onboarding />

  const View = { home: <Dashboard go={go} />, accounts: <Accounts />, income: <KindPage kind="income" />, expenses: <KindPage kind="expense" />, gold: <Gold />, debts: <Debts />, recurring: <Recurring />, charity: <Charity />, reports: <Reports />, ledger: <Ledger />, settings: <Settings /> }[page] || <Dashboard go={go} />
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><span className="logo-mark sm">₺</span><div><b>{s.household?.name}</b><small>{s.me.display_name}</small></div></div>
        <nav>{NAV.map(([k, l, i]) => <button key={k} className={page === k ? 'on' : ''} onClick={() => go(k)}><span>{i}</span>{l}</button>)}</nav>
      </aside>
      <main className="main">
        <SyncBadge />
        <div className="quick-desktop noprint">
          <button className="btn btn-green" onClick={() => s.openTx('income')}>+ إضافة دخل</button>
          <button className="btn btn-red" onClick={() => s.openTx('expense')}>− إضافة مصروف</button>
        </div>
        {View}
      </main>
      <div className="fabbar noprint">
        <button className="btn btn-green" onClick={() => s.openTx('income')}>+ إضافة دخل</button>
        <button className="btn btn-red" onClick={() => s.openTx('expense')}>− إضافة مصروف</button>
      </div>
      <nav className="bottom noprint">
        {MOBILE.map(k => { const [, l, i] = NAV.find(n => n[0] === k); return <button key={k} className={page === k ? 'on' : ''} onClick={() => go(k)}><span>{i}</span>{l}</button> })}
        <button className={more || !MOBILE.includes(page) ? 'on' : ''} onClick={() => setMore(!more)}><span>☰</span>المزيد</button>
      </nav>
      {more && <div className="more" onClick={() => setMore(false)}><div className="more-grid" onClick={e => e.stopPropagation()}>{NAV.filter(n => !MOBILE.includes(n[0])).map(([k, l, i]) => <button key={k} onClick={() => go(k)}><span>{i}</span>{l}</button>)}</div></div>}
      {s.dialog && <TxForm kind={s.dialog.kind} initial={s.dialog.initial} onSaved={s.dialog.onSaved} onClose={s.closeDialog} />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!configured) return <Setup />
  if (session === undefined) return <Splash />
  if (!session) return <Auth />
  return <StoreProvider key={session.user.id} session={session}><Shell /></StoreProvider>
}
