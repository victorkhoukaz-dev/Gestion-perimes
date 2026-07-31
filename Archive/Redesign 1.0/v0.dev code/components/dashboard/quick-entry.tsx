'use client'

import { useRef, useState } from 'react'
import {
  SECTIONS,
  formatExpiry,
  type ExpiredProduct,
  type ProductStatus,
} from '@/lib/pharmacy-data'
import { StatusBadge } from './status-badge'

let idCounter = 1000

function classifyExpiry(expiry: string): ProductStatus {
  // "Juin 2026" is the active retrait month → expired if <= it, soon if next month.
  const current = '2026-06'
  if (!expiry) return 'ok'
  if (expiry <= current) return 'expired'
  if (expiry === '2026-07') return 'soon'
  return 'ok'
}

export function QuickEntry({ initials }: { initials: string }) {
  const [cip, setCip] = useState('')
  const [name, setName] = useState('')
  const [section, setSection] = useState(SECTIONS[0] as string)
  const [quantity, setQuantity] = useState('1')
  const [expiry, setExpiry] = useState('2026-06')
  const [added, setAdded] = useState<ExpiredProduct[]>([])
  const cipRef = useRef<HTMLElement | null>(null)

  function submit() {
    if (!name.trim()) return
    const product: ExpiredProduct = {
      id: String(idCounter++),
      name: name.trim(),
      cip: cip.trim() || '—',
      section,
      quantity: Number(quantity) || 1,
      expiry,
      status: classifyExpiry(expiry),
      addedBy: initials || 'VK',
    }
    setAdded((prev) => [product, ...prev])
    // Reset for the next scan — keep section & expiry for a fast rhythm.
    setCip('')
    setName('')
    setQuantity('1')
    // Return focus to the first field for continuous entry.
    requestAnimationFrame(() => {
      const el = cipRef.current as (HTMLElement & { focus?: () => void }) | null
      el?.focus?.()
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !(e.nativeEvent as { isComposing?: boolean }).isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="split">
      <md-outlined-card class="card entry-card">
        <div className="card-head">
          <div>
            <h2 className="panel-title md-typescale-title-large">
              <md-icon aria-hidden="true">bolt</md-icon>
              Saisie rapide
            </h2>
            <p className="panel-sub md-typescale-body-medium">
              Scannez ou saisissez un produit, puis appuyez sur Entrée.
            </p>
          </div>
          <span className="badge md-typescale-label-medium" style={{
            background: 'var(--md-sys-color-tertiary-container)',
            color: 'var(--md-sys-color-on-tertiary-container)',
          }}>
            <md-icon aria-hidden="true">badge</md-icon>
            {initials || 'VK'}
          </span>
        </div>

        <div className="entry-grid" onKeyDown={onKeyDown}>
          <md-outlined-text-field
            ref={cipRef}
            class="entry-field-cip"
            label="Code CIP / Code-barres"
            value={cip}
            inputmode="numeric"
            onInput={(e: React.FormEvent) =>
              setCip((e.target as HTMLInputElement).value)
            }
          >
            <md-icon slot="leading-icon">barcode_scanner</md-icon>
          </md-outlined-text-field>

          <md-outlined-text-field
            label="Nom du produit"
            value={name}
            onInput={(e: React.FormEvent) =>
              setName((e.target as HTMLInputElement).value)
            }
          />

          <md-outlined-select
            label="Rayon / Section"
            value={section}
            onChange={(e: React.FormEvent) =>
              setSection((e.target as HTMLSelectElement).value)
            }
          >
            {SECTIONS.map((s) => (
              <md-select-option key={s} value={s} selected={s === section}>
                <div slot="headline">{s}</div>
              </md-select-option>
            ))}
          </md-outlined-select>

          <md-outlined-text-field
            label="Quantité"
            type="number"
            min={1}
            value={quantity}
            onInput={(e: React.FormEvent) =>
              setQuantity((e.target as HTMLInputElement).value)
            }
          />

          <md-outlined-text-field
            label="Date d'expiration"
            type="month"
            value={expiry}
            onInput={(e: React.FormEvent) =>
              setExpiry((e.target as HTMLInputElement).value)
            }
          />
        </div>

        <div className="entry-actions">
          <md-filled-button onClick={submit}>
            <md-icon slot="icon">add</md-icon>
            Ajouter au retrait
          </md-filled-button>
          <span className="entry-hint md-typescale-body-small">
            <span className="kbd">Entrée</span>
            pour ajouter et enchaîner
          </span>
        </div>
      </md-outlined-card>

      <div className="card entry-card" style={{ gap: 16 }}>
        <div className="session-card">
          <span className="session-avatar md-typescale-title-medium">
            {initials || 'VK'}
          </span>
          <span className="session-info">
            <span className="md-typescale-title-small">Session technicien</span>
            <span className="md-typescale-body-small">
              Ajouts sans confirmation à chaque clic
            </span>
          </span>
        </div>

        <div>
          <h3 className="panel-title md-typescale-title-medium">
            Ajoutés dans cette tournée
          </h3>
          <p className="panel-sub md-typescale-body-small">
            {added.length} produit{added.length === 1 ? '' : 's'} enregistré
            {added.length === 1 ? '' : 's'}
          </p>
        </div>

        {added.length === 0 ? (
          <div className="placeholder" style={{ padding: '32px 8px' }}>
            <span className="pico" aria-hidden="true">
              <md-icon>playlist_add</md-icon>
            </span>
            <p className="md-typescale-body-medium" style={{ margin: 0 }}>
              Les produits ajoutés apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="entry-list">
            {added.map((p) => (
              <div className="entry-item" key={p.id}>
                <div className="meta">
                  <span className="name md-typescale-body-medium">
                    {p.name}
                  </span>
                  <span className="cip md-typescale-body-small">
                    {p.section} · Qté {p.quantity} · {formatExpiry(p.expiry)}
                  </span>
                </div>
                <StatusBadge status={p.status} />
                <md-icon-button aria-label={`Retirer ${p.name}`}>
                  <md-icon>close</md-icon>
                </md-icon-button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
