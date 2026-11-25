import { useStore } from '../lib/store'
import { IN, OUT, KIND_LABEL } from '../lib/finance'
import { Money, Empty } from './ui'

export function TxRow({ t, onClick }) {
  const s = useStore()
  const cat = s.catOf(t.category_id)
  const isIn = IN.includes(t.kind), isOut = OUT.includes(t.kind)
  const glyph = t.kind === 'transfer' ? '⇄' : isIn ? '＋' : '−'
  const title = t.description || cat?.name || KIND_LABEL[t.kind]
  const where = t.kind === 'transfer' ? `${s.accName(t.account_id)} ← ${s.accName(t.to_account_id)}` : s.accName(t.account_id)
  const acc = s.accounts.find(a => a.id === t.account_id)
  return (
    <button type="button" className="tx" onClick={onClick}>
      <span className={`tx-ic ${t.kind === 'transfer' ? 'neutral' : isIn ? 'in' : 'out'}`}>{t.kind === 'income' || t.kind === 'expense' ? (cat?.icon || glyph) : glyph}</span>
      <span className="tx-main">
        <b>{title}</b>
        <small>
          {!['income', 'expense'].includes(t.kind) && <em className="tag">{KIND_LABEL[t.kind]}</em>}
          {t.date_label || t.occurred_on} · {where} · {s.nameOf(t.owner)} · بواسطة {s.userName(t.created_by)}
          {t._pending && <em className="tag warn">بانتظار المزامنة</em>}
        </small>
      </span>
      <Money v={t.amount} cur={acc?.currency} plus={false} tone={t.kind === 'transfer' ? '' : isIn ? 'pos' : isOut ? 'neg' : ''} className="tx-amt" />
    </button>
  )
}

export function TxList({ txs, onEdit, empty = 'لا توجد عمليات' }) {
  if (!txs.length) return <Empty text={empty} />
  return <div className="txlist">{txs.map(t => <TxRow key={t.id} t={t} onClick={() => onEdit?.(t)} />)}</div>
}
