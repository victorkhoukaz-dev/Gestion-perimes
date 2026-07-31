'use client'

import { formatExpiry, type ExpiredProduct } from '@/lib/pharmacy-data'
import { StatusBadge } from './status-badge'

export function TargetedTable({ products }: { products: ExpiredProduct[] }) {
  return (
    <div className="split">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card-head">
          <div>
            <h2 className="panel-title md-typescale-title-large">
              Produits ciblés — Juin 2026
            </h2>
            <p className="panel-sub md-typescale-body-medium">
              {products.length} références suivies ce mois
            </p>
          </div>
          <div className="card-head-actions">
            <md-outlined-button>
              <md-icon slot="icon">print</md-icon>
              Imprimer la fiche
            </md-outlined-button>
            <md-filled-tonal-button>
              <md-icon slot="icon">download</md-icon>
              Exporter CSV
            </md-filled-tonal-button>
          </div>
        </div>

        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="md-typescale-label-large">Produit</th>
                  <th className="md-typescale-label-large">Rayon</th>
                  <th className="md-typescale-label-large num">Qté</th>
                  <th className="md-typescale-label-large">Expiration</th>
                  <th className="md-typescale-label-large">Statut</th>
                  <th className="md-typescale-label-large">Tech.</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="cell-name">
                        <span className="md-typescale-body-medium">
                          {p.name}
                        </span>
                        <span className="cip md-typescale-body-small">
                          CIP {p.cip}
                        </span>
                      </span>
                    </td>
                    <td className="md-typescale-body-medium">{p.section}</td>
                    <td className="md-typescale-body-medium num">
                      {p.quantity}
                    </td>
                    <td className="md-typescale-body-medium">
                      {formatExpiry(p.expiry)}
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="md-typescale-body-medium">{p.addedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <md-elevated-card class="card" style={{ gap: 16 }}>
          <h3 className="panel-title md-typescale-title-medium">
            Progression du retrait
          </h3>
          <ProgressRow label="Antibiotiques" value={1} total={1} />
          <ProgressRow label="Antalgiques" value={1} total={2} />
          <ProgressRow label="Réfrigérateur" value={0} total={1} />
          <ProgressRow label="Ophtalmologie" value={0} total={1} />
        </md-elevated-card>
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const pct = total === 0 ? 0 : value / total
  return (
    <div className="progress-card" style={{ padding: 0, border: 'none' }}>
      <div className="progress-head">
        <span className="md-typescale-body-medium">{label}</span>
        <span className="md-typescale-label-medium num">
          {value}/{total}
        </span>
      </div>
      <md-linear-progress value={pct} />
    </div>
  )
}
