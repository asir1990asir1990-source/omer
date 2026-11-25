import { addDays, todayStr } from './finance'

// بيانات تجريبية للتجربة فقط — تُحذف كلها بزر «حذف البيانات التجريبية» من الإعدادات
export async function loadDemo(s) {
  const mk = (name, type, owner, opening) => ({ id: crypto.randomUUID(), name, type, owner, opening_balance: opening, currency: s.base, is_demo: true })
  const A = [mk('Papara', 'wallet', 'husband', 5000), mk('Vakıf Katılım', 'bank', 'shared', 25000), mk('Option', 'wallet', 'wife', 3000), mk('نقداً مع الزوج', 'cash', 'husband', 2500), mk('نقداً مع الزوجة', 'cash', 'wife', 1500)]
  await s.db.upsert('accounts', A, 'id', 'accounts')
  const cat = n => s.categories.find(c => c.name.startsWith(n))?.id || null
  const t = todayStr()
  const row = (kind, amount, daysAgo, acc, o) => ({ id: crypto.randomUUID(), client_id: crypto.randomUUID(), kind, amount, occurred_on: addDays(t, -daysAgo), account_id: A[acc].id, owner: 'shared', is_demo: true, ...o })
  const rows = [
    row('income', 30000, 12, 1, { description: 'الراتب الشهري', category_id: cat('الراتب'), owner: 'husband' }),
    row('income', 12000, 10, 2, { description: 'راتب الزوجة', category_id: cat('الراتب'), owner: 'wife' }),
    row('expense', 850, 9, 1, { description: 'سوق الأسبوع', category_id: cat('الطعام'), beneficiary: 'shared' }),
    row('expense', 9500, 8, 1, { description: 'إيجار الشقة', category_id: cat('الإيجار'), beneficiary: 'shared' }),
    row('expense', 420, 6, 3, { description: 'وقود', category_id: cat('الوقود'), owner: 'husband', beneficiary: 'shared' }),
    row('expense', 350, 5, 2, { description: 'ملابس', category_id: cat('الملابس'), owner: 'wife', beneficiary: 'wife' }),
    row('expense', 150, 3, 3, { description: 'قهوة مع الأصدقاء', category_id: cat('المطاعم'), owner: 'husband', beneficiary: 'husband' }),
    row('expense', 600, 2, 4, { description: 'ألعاب أطفال', category_id: cat('الأطفال'), owner: 'wife', beneficiary: 'shared' }),
    row('expense', 200, 1, 3, { description: 'صدقة الجمعة', category_id: cat('الصدقات'), owner: 'husband', beneficiary: 'shared' }),
    row('transfer', 2000, 4, 0, { to_account_id: A[3].id, description: 'سحب من Papara' }),
  ]
  await s.db.upsert('transactions', rows, 'id', 'transactions')
  await s.db.insert('gold_holdings', { karat: 21, grams: 25, pieces: 3, purchase_date: addDays(t, -200), price_per_gram: 2400, is_demo: true }, 'gold')
  await s.db.insert('recurring_items', { name: 'فاتورة الإنترنت', amount: 450, frequency: 'monthly', next_due: addDays(t, 2), account_id: A[1].id, category_id: cat('الفواتير'), owner: 'shared', is_demo: true }, 'recurring')
  const debtId = crypto.randomUUID()
  await s.db.insert('debts', { id: debtId, direction: 'owed_to_us', person_name: 'أحمد (تجريبي)', principal: 3000, due_date: addDays(t, 20), is_demo: true }, 'debts')
}
