// كل الحسابات المالية في مكان واحد. لا أرقام مخزّنة قابلة للانحراف: كل شيء يُشتق من الحركات.
export const IN = ['income', 'loan_received', 'debt_collect', 'adjust_in']
export const OUT = ['expense', 'loan_given', 'debt_repay', 'adjust_out']

export const KIND_LABEL = {
  income: 'دخل', expense: 'مصروف', transfer: 'تحويل',
  loan_received: 'قرض مستلم', loan_given: 'قرض ممنوح',
  debt_repay: 'سداد دين', debt_collect: 'تحصيل دين',
  adjust_in: 'تسوية (زيادة)', adjust_out: 'تسوية (نقص)',
}
export const ACC_TYPES = { cash: 'نقد', bank: 'حساب بنكي', wallet: 'محفظة إلكترونية', other: 'أخرى' }
export const FREQ = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي', custom: 'مخصص' }
export const CURRENCIES = ['TRY', 'USD', 'EUR']

const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0)
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100
const iso = d => d.toLocaleDateString('sv-SE')

// ---------- التواريخ ----------
export const todayStr = () => iso(new Date())
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }
export const daysUntil = s => Math.round((new Date(s + 'T12:00:00') - new Date(todayStr() + 'T12:00:00')) / 864e5)
export function addFreq(s, freq, custom = 30) {
  const d = new Date(s + 'T12:00:00')
  if (freq === 'daily') d.setDate(d.getDate() + 1)
  else if (freq === 'weekly') d.setDate(d.getDate() + 7)
  else if (freq === 'monthly') {
    const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  } else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setDate(d.getDate() + Number(custom || 30))
  return iso(d)
}
export function monthRange(offset = 0) {
  const n = new Date()
  const s = new Date(n.getFullYear(), n.getMonth() + offset, 1)
  const e = new Date(n.getFullYear(), n.getMonth() + offset + 1, 0)
  return { from: iso(s), to: iso(e), label: s.toLocaleDateString('ar-u-nu-latn', { month: 'long', year: 'numeric' }) }
}
export function periodRange(type, c = {}) {
  const t = todayStr()
  if (type === 'day') return { from: t, to: t }
  if (type === 'week') return { from: addDays(t, -6), to: t }
  if (type === 'month') return monthRange(0)
  if (type === 'year') { const y = new Date().getFullYear(); return { from: `${y}-01-01`, to: `${y}-12-31` } }
  return { from: c.from || t, to: c.to || t }
}
export const inRange = (t, r) => t.occurred_on >= r.from && t.occurred_on <= r.to

export function parseAmount(v) {
  const s = String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.').replace(/[^\d.]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

// ---------- الأرصدة ----------
// رصيد الحساب = الرصيد الافتتاحي + الحركات الداخلة − الحركات الخارجة
export function balances(accounts, txs) {
  const b = {}
  accounts.forEach(a => { b[a.id] = Number(a.opening_balance || 0) })
  for (const t of txs) {
    const amt = Number(t.amount)
    if (t.kind === 'transfer') {
      if (t.account_id in b) b[t.account_id] -= amt
      if (t.to_account_id in b) b[t.to_account_id] += amt
    } else if (t.account_id in b) {
      if (IN.includes(t.kind)) b[t.account_id] += amt
      else if (OUT.includes(t.kind)) b[t.account_id] -= amt
    }
  }
  Object.keys(b).forEach(k => { b[k] = r2(b[k]) })
  return b
}

// المتبقي من الدين = الأصل − مجموع الدفعات (سداد/تحصيل فقط)
export function debtInfo(debts, txs) {
  const out = {}
  debts.forEach(d => { out[d.id] = { paid: 0, payments: [], remaining: Number(d.principal) } })
  for (const t of txs) {
    if ((t.kind === 'debt_repay' || t.kind === 'debt_collect') && out[t.debt_id]) {
      out[t.debt_id].paid += Number(t.amount)
      out[t.debt_id].payments.push(t)
    }
  }
  Object.values(out).forEach(o => { o.paid = r2(o.paid); o.remaining = r2(o.remaining - o.paid) })
  return out
}

export function goldInfo(holdings, prices) {
  const out = {}
  let cost = 0, value = 0, grams = 0
  for (const k of [24, 21, 18]) {
    const hs = holdings.filter(h => Number(h.karat) === k)
    const g = sum(hs, h => h.grams)
    const c = sum(hs, h => Number(h.grams) * Number(h.price_per_gram))
    const p = prices.find(x => Number(x.karat) === k)
    const price = p ? Number(p.price_per_gram) : null
    const v = price != null ? g * price : c
    out[k] = { grams: g, cost: c, price, value: v, estimated: price == null && g > 0, pieces: sum(hs, h => h.pieces), count: hs.length }
    cost += c; value += v; grams += g
  }
  out.total = { grams, cost, value }
  return out
}

export function computeAll({ accounts, transactions, debts, gold, goldPrices }, base = 'TRY') {
  const bal = balances(accounts, transactions)
  const baseAcc = accounts.filter(a => a.currency === base)
  const cash = sum(baseAcc.filter(a => a.type === 'cash'), a => bal[a.id])
  const bank = sum(baseAcc.filter(a => a.type !== 'cash'), a => bal[a.id])
  const di = debtInfo(debts, transactions)
  const owedToUs = sum(debts.filter(d => d.direction === 'owed_to_us'), d => di[d.id].remaining)
  const weOwe = sum(debts.filter(d => d.direction === 'we_owe'), d => di[d.id].remaining)
  const g = goldInfo(gold, goldPrices)
  const netWorth = cash + bank + g.total.value + owedToUs - weOwe
  return { bal, cash, bank, liquid: cash + bank, di, owedToUs, weOwe, gold: g, netWorth: r2(netWorth) }
}

// ---------- ملخص الدخل والمصروف ----------
export function summarize(txs) {
  const z = () => ({ husband: 0, wife: 0, shared: 0 })
  const s = { income: 0, expense: 0, fixed: 0, incomeBy: z(), expenseBy: z(), benBy: z(), cat: {}, incomeCat: {} }
  for (const t of txs) {
    const a = Number(t.amount)
    if (t.kind === 'income') {
      s.income += a; s.incomeBy[t.owner] += a
      const k = t.category_id || 'none'; s.incomeCat[k] = (s.incomeCat[k] || 0) + a
    } else if (t.kind === 'expense') {
      s.expense += a; s.expenseBy[t.owner] += a; s.benBy[t.beneficiary || 'shared'] += a
      if (t.recurring_id) s.fixed += a
      const k = t.category_id || 'none'; s.cat[k] = (s.cat[k] || 0) + a
    }
  }
  s.net = s.income - s.expense
  return s
}

// تطور المدخرات: السيولة + الذهب (بسعر الشراء) في نهاية كل شهر
export function savingsSeries(accounts, txs, gold, base = 'TRY', months = 12) {
  const ids = new Set(accounts.filter(a => a.currency === base).map(a => a.id))
  const opening = sum(accounts.filter(a => ids.has(a.id)), a => a.opening_balance)
  const out = []
  for (let i = months - 1; i >= 0; i--) {
    const r = monthRange(-i)
    let v = opening
    for (const t of txs) {
      if (t.occurred_on > r.to) continue
      const a = Number(t.amount)
      if (t.kind === 'transfer') { if (ids.has(t.account_id)) v -= a; if (ids.has(t.to_account_id)) v += a }
      else if (ids.has(t.account_id)) v += IN.includes(t.kind) ? a : -a
    }
    v += sum(gold.filter(g => g.purchase_date <= r.to), g => Number(g.grams) * Number(g.price_per_gram))
    out.push({ label: r.label, value: r2(v) })
  }
  return out
}

// ---------- الصدقات ----------
export function charityDue(plans, txs, cats) {
  const ch = cats.find(c => c.system_key === 'charity')
  if (!ch) return []
  const last = txs.filter(t => t.kind === 'expense' && t.category_id === ch.id).map(t => t.occurred_on).sort().at(-1) || ''
  const today = todayStr()
  const hm = new Date().toTimeString().slice(0, 5)
  return plans.filter(p => p.is_active).filter(p => {
    const timeOk = hm >= String(p.remind_time || '00:00').slice(0, 5)
    if (p.frequency === 'daily') return last < today && timeOk
    if (p.frequency === 'weekly') return last < addDays(today, -6) && timeOk
    if (p.frequency === 'monthly') return last < today.slice(0, 8) + '01' && timeOk
    return p.remind_on && (today > p.remind_on || (today === p.remind_on && timeOk)) && last < p.remind_on
  })
}

// ---------- التنبيهات ----------
export function buildAlerts({ recurring, charity, txs, categories, calc, accounts, pending }) {
  const out = []
  for (const r of recurring.filter(r => r.is_active && r.remind)) {
    const d = daysUntil(r.next_due)
    if (d < 0) out.push({ tone: 'bad', text: `${r.name} غير مدفوع — متأخر ${d === -1 ? 'يوماً واحداً' : -d + ' أيام'}`, go: 'recurring' })
    else if (d === 0) out.push({ tone: 'bad', text: `${r.name} يستحق اليوم`, go: 'recurring' })
    else if (d <= 7) out.push({ tone: 'warn', text: `${r.name} يستحق ${d === 1 ? 'غداً' : d === 2 ? 'بعد يومين' : 'بعد ' + d + ' أيام'}`, go: 'recurring' })
  }
  for (const p of charityDue(charity, txs, categories)) {
    out.push({ tone: 'gold', text: p.message || 'لا تنسَ أن تجعل لك نصيباً من الصدقة اليوم', go: 'charity' })
  }
  const spent = summarize(txs.filter(t => inRange(t, monthRange(0)))).cat
  for (const c of categories.filter(c => c.kind === 'expense' && Number(c.monthly_budget) > 0)) {
    const p = (spent[c.id] || 0) / Number(c.monthly_budget)
    if (p >= 1) out.push({ tone: 'bad', text: `تجاوزتم ميزانية «${c.name}» هذا الشهر`, go: 'expenses' })
    else if (p >= 0.8) out.push({ tone: 'warn', text: `اقتربتم من ميزانية «${c.name}» (${Math.round(p * 100)}%)`, go: 'expenses' })
  }
  for (const a of accounts.filter(a => !a.is_hidden && calc.bal[a.id] < 0)) {
    out.push({ tone: 'bad', text: `رصيد «${a.name}» سالب — تحقق من العمليات`, go: 'accounts' })
  }
  if (pending > 0) out.push({ tone: 'warn', text: `${pending} عملية بانتظار المزامنة`, go: 'ledger' })
  return out
}

// ---------- التصدير ----------
export function downloadCSV(name, rows) {
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const blob = new Blob(['\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export function downloadJSON(name, obj) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }))
  a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
