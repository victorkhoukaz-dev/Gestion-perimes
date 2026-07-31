import { STATUS_META, type ProductStatus } from '@/lib/pharmacy-data'

export function StatusBadge({ status }: { status: ProductStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="badge md-typescale-label-medium"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <md-icon aria-hidden="true">{meta.icon}</md-icon>
      {meta.label}
    </span>
  )
}
