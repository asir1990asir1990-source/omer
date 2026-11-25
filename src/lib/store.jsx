import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { computeAll, buildAlerts } from './finance'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const TABLES = {
  members: 'members', accounts: 'accounts', categories: 'categories', transactions: 'transactions',
  debts: 'debts', gold: 'gold_holdings', goldPrices: 'gold_prices', recurring: 'recurring_items', charity: 'charity_plans',
}
const SOFT = ['transactions', 'debts', 'gold']
const PAGE = 1000

export async function fetchAll(table, soft = false) {
  let out = [], from = 0
  for (;;) {
    let q = supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (soft) q = q.is('deleted_at', null)
    if (table === 'transactions') q = q.order('occurred_on', { ascending: false }).order('created_at', { ascending: false })
    else if (table === 'categories') q = q.order('sort').order('name')
    else if (table !== 'gold_prices') q = q.order('created_at')
    const { data, error } = await q
    if (error) throw error
    out = out.concat(data)
    if (data.length < PAGE) return out
    from += PAGE
  }
}
const fetchKey = key => fetchAll(TABLES[key], SOFT.includes(key))

const qKey = uid => 'ff_queue_' + uid
const readQueue = uid => { try { return JSON.parse(localStorage.getItem(qKey(uid)) || '[]') } catch { return [] } }
const writeQueue = (uid, q) => localStorage.setItem(qKey(uid), JSON.stringify(q))
const isNetErr = e => !e?.code && (!navigator.onLine || /fetch|network|load failed/i.test(e?.message || ''))

export function StoreProvider({ session, children }) {
  const uid = session.user.id
  const [state, setState] = useState({
    loading: true, error: null, me: null, household: null,
    members: [], accounts: [], categories: [], transactions: [], debts: [], gold: [], goldPrices: [], recurring: [], charity: [],
  })
  const [pending, setPending] = useState(() => readQueue(uid))
  const [online, setOnline] = useState(navigator.onLine)
  const [dialog, setDialog] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const hid = useRef(null)
  const timers = useRef({})

  const toast = useCallback(m => { setToastMsg(m); clearTimeout(timers.current.toast); timers.current.toast = setTimeout(() => setToastMsg(''), 3200) }, [])

  const refresh = useCallback(key => {
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => {
      fetchKey(key).then(rows => setState(s => ({ ...s, [key]: rows }))).catch(() => {})
    }, 120)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const { data: me, error } = await supabase.from('members').select('*').eq('user_id', uid).maybeSingle()
      if (error) throw error
      if (!me) { setState(s => ({ ...s, loading: false, me: null })); return }
      hid.current = me.household_id
      const keys = Object.keys(TABLES)
      const [hh, ...rows] = await Promise.all([supabase.from('households').select('*').single(), ...keys.map(fetchKey)])
      const next = {}; keys.forEach((k, i) => { next[k] = rows[i] })
      setState(s => ({ ...s, ...next, me, household: hh.data, loading: false, error: null }))
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e.message || String(e) }))
    }
  }, [uid])

  useEffect(() => { loadAll() }, [loadAll])

  // ----- المزامنة اللحظية -----
  useEffect(() => {
    if (!state.me) return
    const ch = supabase.channel('hh-' + state.me.household_id)
    Object.entries(TABLES).forEach(([key, table]) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh(key))
    })
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [state.me?.household_id, refresh])

  // ----- طابور العمليات دون اتصال -----
  const flushing = useRef(false)
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      let q = readQueue(uid), changed = false
      for (const item of q) {
        if (item.error) continue
        try {
          const { error } = await supabase.from('transactions').upsert(item.row, { onConflict: 'client_id', ignoreDuplicates: true })
          if (error) throw error
          item.done = true; changed = true
        } catch (e) {
          if (isNetErr(e)) break
          item.error = e.message; changed = true
        }
      }
      if (changed) { q = q.filter(i => !i.done); writeQueue(uid, q); setPending(q); refresh('transactions') }
    } finally { flushing.current = false }
  }, [uid, refresh])

  useEffect(() => {
    const on = () => { setOnline(true); flush(); loadAll() }
    const off = () => setOnline(false)
    const vis = () => { if (document.visibilityState === 'visible' && navigator.onLine) { flush(); Object.keys(TABLES).forEach(refresh) } }
    window.addEventListener('online', on); window.addEventListener('offline', off); document.addEventListener('visibilitychange', vis)
    flush()
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); document.removeEventListener('visibilitychange', vis) }
  }, [flush, loadAll, refresh])

  const discardFailed = () => { const q = readQueue(uid).filter(i => !i.error); writeQueue(uid, q); setPending(q) }

  // ----- العمليات المالية -----
  const saveTx = useCallback(async (row, editId) => {
    if (editId) {
      const { error } = await supabase.from('transactions').update(row).eq('id', editId)
      if (error) throw error
      refresh('transactions'); return {}
    }
    const full = { ...row, client_id: row.client_id || crypto.randomUUID() }
    try {
      const { error } = await supabase.from('transactions').upsert(full, { onConflict: 'client_id', ignoreDuplicates: true })
      if (error) throw error
    } catch (e) {
      if (isNetErr(e)) {
        const q = [...readQueue(uid), { row: { ...full, household_id: hid.current, created_by: uid }, at: Date.now() }]
        writeQueue(uid, q); setPending(q)
        return { queued: true }
      }
      throw e
    }
    refresh('transactions'); return {}
  }, [uid, refresh])

  const removeTx = useCallback(async t => {
    if (t._pending) { const q = readQueue(uid).filter(i => i.row.client_id !== t.client_id); writeQueue(uid, q); setPending(q); return }
    const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', t.id)
    if (error) throw error
    refresh('transactions')
  }, [uid, refresh])

  const db = useMemo(() => ({
    async insert(table, row, key) { const { data, error } = await supabase.from(table).insert(row).select().single(); if (error) throw error; key && refresh(key); return data },
    async update(table, id, patch, key) { const { error } = await supabase.from(table).update(patch).eq('id', id); if (error) throw error; key && refresh(key) },
    async remove(table, id, key) { const { error } = await supabase.from(table).delete().eq('id', id); if (error) throw error; key && refresh(key) },
    async softDelete(table, id, key) { const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id); if (error) throw error; key && refresh(key) },
    async upsert(table, rows, onConflict, key) { const { error } = await supabase.from(table).upsert(rows, { onConflict }); if (error) throw error; key && refresh(key) },
  }), [refresh])

  // ----- القيم المشتقة -----
  const me = useMemo(() => state.members.find(m => m.user_id === uid) || state.me, [state.members, state.me, uid])
  const base = state.household?.currency || 'TRY'

  const txs = useMemo(() => {
    const have = new Set(state.transactions.map(t => t.client_id).filter(Boolean))
    const pend = pending.filter(p => !p.error && !have.has(p.row.client_id)).map(p => ({ ...p.row, id: 'p-' + p.row.client_id, _pending: true, created_at: new Date(p.at).toISOString() }))
    return [...pend, ...state.transactions].sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : a.occurred_on > b.occurred_on ? -1 : (a.created_at < b.created_at ? 1 : -1)))
  }, [state.transactions, pending])

  const calc = useMemo(() => computeAll({ ...state, transactions: txs }, base), [state, txs, base])
  const visibleAccounts = useMemo(() => state.accounts.filter(a => !a.is_hidden), [state.accounts])

  const nameOf = useCallback(owner => {
    if (owner === 'shared' || !owner) return 'مشترك'
    return state.members.find(m => m.role === owner)?.display_name || (owner === 'husband' ? 'الزوج' : 'الزوجة')
  }, [state.members])
  const userName = useCallback(id => state.members.find(m => m.user_id === id)?.display_name || '—', [state.members])
  const accName = useCallback(id => state.accounts.find(a => a.id === id)?.name || '—', [state.accounts])
  const catOf = useCallback(id => state.categories.find(c => c.id === id), [state.categories])

  const alerts = useMemo(() => buildAlerts({
    recurring: state.recurring, charity: state.charity, txs, categories: state.categories, calc, accounts: state.accounts,
    pending: pending.filter(p => !p.error).length,
  }), [state.recurring, state.charity, txs, state.categories, calc, state.accounts, pending])

  const value = {
    ...state, me, uid, base, txs, calc, alerts, online, pending, visibleAccounts,
    nameOf, userName, accName, catOf, toast, refresh, loadAll, flush, discardFailed, saveTx, removeTx, db,
    dialog, openTx: (kind, initial, onSaved) => setDialog({ kind, initial, onSaved }), closeDialog: () => setDialog(null),
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  )
}
