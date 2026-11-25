import { useStore } from '../lib/store'
import { monthRange, summarize, inRange } from '../lib/finance'
import { Money, Card, Donut, Bars, PALETTE } from '../components/ui'
import { TxList } from '../components/TxList'

export default function Dashboard({ go }) {
  const s = useStore(); const c = s.calc
  const r = monthRange(0)
  const m = summarize(s.txs.filter(t => inRange(t, r)))
  const catRows = Object.entries(m.cat).map(([id, v], i) => ({ label: id === 'none' ? 'بدون تصنيف' : s.catOf(id)?.name, icon: s.catOf(id)?.icon, value: v })).sort((a, b) => b.value - a.value)
  const donut = catRows.slice(0, 6).map((x, i) => ({ ...x, color: PALETTE[i] }))
  const max = Math.max(m.income, m.expense, 1)
  const stat = (label, v, to, tone) => <button className="stat" onClick={() => go(to)}><span>{label}</span><Money v={v} tone={tone} /></button>

  return (
    <div className="stack">
      {s.alerts.length > 0 && (
        <div className="alerts">{s.alerts.map((a, i) => <button key={i} className={`alert ${a.tone}`} onClick={() => go(a.go)}>{a.text}</button>)}</div>
      )}
      <section className="hero">
        <span>صافي الثروة العائلية</span>
        <Money v={c.netWorth} className="hero-num" />
        <small>الأرصدة + الذهب + ديون لنا − ديون علينا</small>
      </section>
      <div className="stats">
        {stat('نقد', c.cash, 'accounts')}
        {stat('بنوك ومحافظ', c.bank, 'accounts')}
        <button className="stat gold" onClick={() => go('gold')}><span>الذهب (قيمة سوقية)</span><Money v={c.gold.total.value} /></button>
        {stat('لنا عند الآخرين', c.owedToUs, 'debts', 'pos')}
        {stat('علينا للآخرين', c.weOwe, 'debts', 'neg')}
      </div>

      <Card title={`ملخص ${r.label}`}>
        <div className="grid3">
          <div><small className="muted">الدخل</small><div><Money v={m.income} tone="pos" /></div></div>
          <div><small className="muted">المصروفات</small><div><Money v={m.expense} tone="neg" /></div></div>
          <div><small className="muted">المتبقي</small><div><Money v={m.net} tone="auto" /></div></div>
        </div>
        <div className="duo">
          <div className="duo-row"><i style={{ width: `${m.income / max * 100}%`, background: 'var(--green)' }} /></div>
          <div className="duo-row"><i style={{ width: `${m.expense / max * 100}%`, background: 'var(--red)' }} /></div>
        </div>
        <div className="kv">
          <span>مصروفات ثابتة</span><Money v={m.fixed} />
          <span>شخصية — {s.nameOf('husband')}</span><Money v={m.benBy.husband} />
          <span>شخصية — {s.nameOf('wife')}</span><Money v={m.benBy.wife} />
          <span>مشتركة للعائلة</span><Money v={m.benBy.shared} />
        </div>
      </Card>

      <Card title="أين تذهب الأموال؟" action={<button className="link" onClick={() => go('reports')}>التقارير</button>}>
        {catRows.length === 0 ? <p className="muted">أضف مصروفاً ليظهر التوزيع هنا.</p> : (
          <div className="split">
            <Donut data={donut} center={<><small>المصروف</small><b><Money v={m.expense} /></b></>} />
            <Bars rows={catRows.slice(0, 6)} />
          </div>
        )}
      </Card>

      <Card title="آخر العمليات" action={<button className="link" onClick={() => go('ledger')}>عرض الكل</button>}>
        <TxList txs={s.txs.slice(0, 8)} onEdit={t => t._pending ? s.toast('بانتظار المزامنة') : s.openTx(t.kind, t)} empty="لا توجد عمليات بعد. ابدأ بإضافة حساب ثم أول عملية." />
      </Card>
    </div>
  )
}
