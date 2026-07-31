'use client'

import { useMemo, useState } from 'react'
import { AppBar } from './app-bar'
import { KpiRow } from './kpi-row'
import { QuickEntry } from './quick-entry'
import { TargetedTable } from './targeted-table'
import { SearchInventory } from './search-inventory'
import { SAMPLE_PRODUCTS, availableMonths } from '@/lib/pharmacy-data'

const TABS = [
  { icon: 'bolt', label: 'Saisie / Tournée' },
  { icon: 'checklist', label: 'Retrait Mensuel' },
  { icon: 'search', label: 'Inventaire & Recherche' },
  { icon: 'settings', label: 'Configuration' },
  { icon: 'menu_book', label: 'Guide & Tuto' },
]

export function Dashboard() {
  const [active, setActive] = useState(0)
  const products = SAMPLE_PRODUCTS

  const months = useMemo(() => availableMonths(products), [products])
  const [month, setMonth] = useState('2026-06')
  const monthProducts = useMemo(
    () => products.filter((p) => p.expiry === month),
    [products, month],
  )

  const kpis = useMemo(() => {
    const expired = monthProducts.filter((p) => p.status === 'expired').length
    const soon = monthProducts.filter((p) => p.status === 'soon').length
    const resolved = monthProducts.filter(
      (p) => p.status === 'resolved',
    ).length
    return [
      {
        value: expired,
        label: 'Produits expirés à retirer',
        icon: 'error',
        bg: 'var(--md-sys-color-error-container)',
        fg: 'var(--md-sys-color-on-error-container)',
      },
      {
        value: soon,
        label: 'Expirent bientôt',
        icon: 'schedule',
        bg: 'var(--md-sys-color-warning-container)',
        fg: 'var(--md-sys-color-on-warning-container)',
      },
      {
        value: resolved,
        label: 'Déjà résolus',
        icon: 'task_alt',
        bg: 'var(--md-sys-color-success-container)',
        fg: 'var(--md-sys-color-on-success-container)',
      },
    ]
  }, [monthProducts])

  return (
    <div className="app">
      <AppBar />

      <div className="tabs-wrap">
        <div className="tabs-inner">
          <md-tabs active-tab-index={active}>
            {TABS.map((t, i) => (
              <md-primary-tab key={t.label} onClick={() => setActive(i)}>
                <md-icon slot="icon">{t.icon}</md-icon>
                {t.label}
              </md-primary-tab>
            ))}
          </md-tabs>
        </div>
      </div>

      <main className="dash">
        <KpiRow kpis={kpis} />

        {active === 0 && <QuickEntry initials="VK" />}
        {active === 1 && <TargetedTable products={products} />}
        {active >= 2 && (
          <div className="card table-card">
            <div className="placeholder">
              <span className="pico" aria-hidden="true">
                <md-icon>{TABS[active].icon}</md-icon>
              </span>
              <h2 className="md-typescale-title-large" style={{ margin: 0 }}>
                {TABS[active].label}
              </h2>
              <p className="md-typescale-body-medium" style={{ margin: 0 }}>
                Cette section fait partie de la maquette. Dites-moi ce
                qu&apos;elle doit contenir et je la construis.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
