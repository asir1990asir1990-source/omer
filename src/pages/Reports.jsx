import { useState } from 'react'
import { useStore } from '../lib/store'
import { periodRange, summarize, inRange, savingsSeries, downloadCSV, KIND_LABEL } from '../lib/finance'
import { Money, Card, Bars, Donut, Line, Seg, Modal, PALETTE } from '../components/ui'
import { TxList } from '../components/TxList'

export default function Reports() {
  const s = useStore()
  const [type, setType] = useState('month'); const [custom, setCustom] = useState({ from: '', to: '' }); const [drill, setDrill] = useState(null)
  const r = periodRange(type, custom)
  const txs = s.txs.filter(t => inRange(t, r))
  const m = summarize(txs)
  const catRows = Object.entries(m.cat).map(([id, v]) => ({ id, label: id === 'none' ? 'بدون تصنيف' : s.catOf(id)?.name, icon: s.catOf(id)?.icon, value: v })).sort((a, b) => b.value - a.value)
  const open = (title, fn) => setDrill({ title, list: txs.filter(fn) })
  const series = savingsSeries(s.accounts, s.txs, s.gold, s.base)

  function exportCsv() {
    const head = ['التاريخ', 'النوع', 'الوصف', 'التصنيف', 'الحساب', 'إلى حساب', 'المبلغ', 'منسوبة إلى', 'المستفيد', 'أضافها', 'ملاحظات']
    const rows = txs.slice().reverse().map(t => [t.occurred_on, KIND_LABEL[t.kind], t.description, s.catOf(t.category_id)?.name, s.accName(t.account_id), t.to_account_id ? s.accName(t.to_account_id) : '', t.amount, s.nameOf(t.owner), t.beneficiary ? s.nameOf(t.beneficiary) : '', s.userName(t.created_by), t.notes])
    downloadCSV(`تقرير_${r.from}_${r.to}.csv`, [head, ...rows])
  }
  const cmp = (title, by, kind) => (
    <Card title={title}>
      <Bars rows={['husband', 'wife', 'shared'].map((o, i) => ({ label: s.nameOf(o), value: by[o], color: PALETTE[i === 2 ? 3 : i], onClick: () => open(`${title} — ${s.nameOf(o)}`, t => t.kind === kind && t.owner === o) }))} />
    </Card>
  )
  return (
    <div className="stack printable">
      <div className="page-h noprint"><h2>التقارير</h2>
        <div className="btn-row"><button className="btn btn-dark small" onClick={exportCsv}>تصدير Excel/CSV</button><button className="btn btn-dark small" onClick={() => window.print()}>طباعة / PDF</button></div>
      </div>
      <div className="noprint"><Seg value={type} onChange={setType} options={[['day', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['year', 'السنة'], ['custom', 'مخصص']]} /></div>
      {type === 'custom' && <div className="grid2 noprint"><input type="date" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} /><input type="date" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} /></div>}
      <p className="muted">الفترة: {r.from} → {r.to}</p>
      <div className="grid3 summary">
        <Card><small className="muted">الدخل</small><div><Money v={m.income} tone="pos" className="big" /></div></Card>
        <Card><small className="muted">المصروفات</small><div><Money v={m.expense} tone="neg" className="big" /></div></Card>
        <Card><small className="muted">{m.net >= 0 ? 'الفائض' : 'العجز'}</small><div><Money v={m.net} tone="auto" className="big" /></div></Card>
      </div>
      <div className="grid-cards">
        {cmp('مقارنة الدخل', m.incomeBy, 'income')}
        {cmp('مقارنة المصروفات (من صرف)', m.expenseBy, 'expense')}
      </div>
      <Card title="المصروفات المشتركة للعائلة"><Money v={m.benBy.shared} className="big" /> <button className="link noprint" onClick={() => open('مصروفات عائلية مشتركة', t => t.kind === 'expense' && (t.beneficiary || 'shared') === 'shared')}>التفاصيل</button></Card>
      <Card title="توزيع المصروفات حسب التصنيف">
        {catRows.length === 0 ? <p className="muted">لا توجد مصروفات في هذه الفترة</p> : (
          <div className="split">
            <Donut data={catRows.slice(0, 8).map((x, i) => ({ ...x, color: PALETTE[i] }))} center={<><small>المجموع</small><b><Money v={m.expense} /></b></>} />
            <Bars rows={catRows.map(x => ({ ...x, onClick: () => open(x.label, t => t.kind === 'expense' && (t.category_id || 'none') === x.id) }))} />
          </div>)}
      </Card>
      <Card title="تطور المدخرات (سيولة + ذهب بسعر الشراء)"><Line values={series.map(x => x.value)} labels={series.map(x => x.label)} /></Card>
      {drill && <Modal wide title={drill.title} onClose={() => setDrill(null)}><TxList txs={drill.list} onEdit={t => { setDrill(null); !t._pending && s.openTx(t.kind, t) }} /></Modal>}
    </div>
  )
}
