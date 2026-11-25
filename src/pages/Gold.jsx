import { useState } from 'react'
import { useStore } from '../lib/store'
import { parseAmount, todayStr } from '../lib/finance'
import { Money, Card, Modal, Field, Err, Empty } from '../components/ui'

function GoldForm({ item, onClose }) {
  const s = useStore()
  const [f, setF] = useState({ karat: item?.karat || 21, grams: item?.grams ?? '', pieces: item?.pieces ?? 1, purchase_date: item?.purchase_date || todayStr(), price_per_gram: item?.price_per_gram ?? '', owner: item?.owner || 'shared', notes: item?.notes || '' })
  const [err, setErr] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const grams = parseAmount(f.grams), ppg = parseAmount(f.price_per_gram)
  async function submit(e) {
    e.preventDefault()
    if (!(grams > 0)) return setErr('أدخل الوزن بالغرام')
    try {
      const row = { karat: Number(f.karat), grams, pieces: Number(f.pieces) || 1, purchase_date: f.purchase_date, price_per_gram: ppg, owner: f.owner, notes: f.notes || null }
      if (item) await s.db.update('gold_holdings', item.id, row, 'gold'); else await s.db.insert('gold_holdings', row, 'gold')
      s.toast('تم الحفظ ✓'); onClose()
    } catch (e2) { setErr(e2.message) }
  }
  return (
    <Modal title={item ? 'تعديل قطعة ذهب' : 'إضافة ذهب'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid2">
          <Field label="العيار"><select value={f.karat} onChange={e => set('karat', e.target.value)}><option value="24">24</option><option value="21">21</option><option value="18">18</option></select></Field>
          <Field label="الوزن (غرام)"><input inputMode="decimal" autoFocus value={f.grams} onChange={e => set('grams', e.target.value)} /></Field>
        </div>
        <div className="grid2">
          <Field label="سعر الغرام عند الشراء"><input inputMode="decimal" value={f.price_per_gram} onChange={e => set('price_per_gram', e.target.value)} /></Field>
          <Field label="عدد القطع"><input type="number" min="1" value={f.pieces} onChange={e => set('pieces', e.target.value)} /></Field>
        </div>
        <p className="muted">القيمة عند الشراء: <Money v={grams * ppg} /></p>
        <div className="grid2">
          <Field label="تاريخ الشراء"><input type="date" value={f.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></Field>
          <Field label="يعود إلى"><select value={f.owner} onChange={e => set('owner', e.target.value)}><option value="husband">{s.nameOf('husband')}</option><option value="wife">{s.nameOf('wife')}</option><option value="shared">مشترك</option></select></Field>
        </div>
        <Field label="ملاحظات"><input value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <Err text={err} /><div className="row-end"><button className="btn btn-gold">حفظ</button></div>
      </form>
    </Modal>
  )
}

export default function Gold() {
  const s = useStore(); const g = s.calc.gold
  const [form, setForm] = useState(null)
  const [prices, setPrices] = useState({})

  async function savePrice(k) {
    const v = parseAmount(prices[k]); if (!(v > 0)) return
    try { await s.db.upsert('gold_prices', { household_id: s.household.id, karat: k, price_per_gram: v, updated_at: new Date().toISOString() }, 'household_id,karat', 'goldPrices'); setPrices(p => ({ ...p, [k]: undefined })); s.toast(`حُدّث سعر عيار ${k} ✓`) }
    catch (e) { s.toast(e.message) }
  }
  async function del(h) {
    if (!confirm('حذف هذه القطعة؟')) return
    try { await s.db.softDelete('gold_holdings', h.id, 'gold'); s.toast('تم الحذف') } catch (e) { s.toast(e.message) }
  }
  const pl = g.total.value - g.total.cost
  return (
    <div className="stack">
      <div className="page-h"><div><h2>الذهب والمدخرات</h2><p className="muted">منفصل عن السيولة النقدية</p></div><button className="btn btn-gold" onClick={() => setForm({})}>+ إضافة ذهب</button></div>
      <section className="hero gold-hero">
        <span>القيمة السوقية التقريبية</span><Money v={g.total.value} className="hero-num" />
        <small>{g.total.grams} غرام · التكلفة <Money v={g.total.cost} /> · {pl >= 0 ? 'ربح' : 'خسارة'} <Money v={Math.abs(pl)} /></small>
      </section>
      <div className="grid-cards">
        {[24, 21, 18].map(k => (
          <Card key={k} title={`عيار ${k}`}>
            <div className="kv"><span>الوزن</span><b className="num" dir="ltr">{g[k].grams} g</b><span>التكلفة</span><Money v={g[k].cost} /><span>القيمة</span><Money v={g[k].value} /></div>
            {g[k].estimated && <small className="muted">مقدّرة بسعر الشراء — حدّد سعر الغرام الحالي</small>}
            <div className="inline-form">
              <input inputMode="decimal" placeholder={g[k].price ? `سعر الغرام الحالي: ${g[k].price}` : 'سعر الغرام الحالي'} value={prices[k] ?? ''} onChange={e => setPrices(p => ({ ...p, [k]: e.target.value }))} />
              <button className="btn btn-dark small" onClick={() => savePrice(k)}>تحديث</button>
            </div>
          </Card>
        ))}
      </div>
      <Card title="القطع المسجّلة">
        {s.gold.length === 0 ? <Empty text="لم تُسجَّل مدخرات ذهبية بعد" /> : (
          <div className="txlist">{s.gold.map(h => (
            <div key={h.id} className="tx static">
              <span className="tx-ic gold">{h.karat}</span>
              <span className="tx-main"><b>{h.grams} غرام · {h.pieces} قطعة</b><small>{h.purchase_date} · {s.nameOf(h.owner)}{h.notes ? ' · ' + h.notes : ''}</small></span>
              <span className="col-end"><Money v={h.grams * h.price_per_gram} /><span><button className="link" onClick={() => setForm(h)}>تعديل</button> <button className="link danger" onClick={() => del(h)}>حذف</button></span></span>
            </div>))}</div>
        )}
      </Card>
      {form && <GoldForm item={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  )
}
