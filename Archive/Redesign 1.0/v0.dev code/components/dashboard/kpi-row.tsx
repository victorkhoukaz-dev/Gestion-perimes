'use client'

interface Kpi {
  value: number
  label: string
  icon: string
  bg: string
  fg: string
}

export function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="kpi-row" aria-label="Indicateurs du mois">
      {kpis.map((k) => (
        <md-elevated-card key={k.label} class="kpi">
          <span
            className="kpi-icon"
            style={{ background: k.bg, color: k.fg }}
            aria-hidden="true"
          >
            <md-icon>{k.icon}</md-icon>
          </span>
          <span className="kpi-body">
            <span className="kpi-value md-typescale-display-small">
              {k.value}
            </span>
            <span className="kpi-label md-typescale-body-medium">
              {k.label}
            </span>
          </span>
        </md-elevated-card>
      ))}
    </section>
  )
}
