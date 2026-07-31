export type ProductStatus = 'expired' | 'soon' | 'ok' | 'resolved'

export interface ExpiredProduct {
  id: string
  name: string
  cip: string
  section: string
  quantity: number
  expiry: string // ISO date (year-month) e.g. "2026-06"
  status: ProductStatus
  addedBy: string
}

export const SECTIONS = [
  'Antibiotiques',
  'Antalgiques',
  'Dermatologie',
  'Ophtalmologie',
  'Réfrigérateur',
  'Homéopathie',
  'Vétérinaire',
  'Comptoir',
] as const

/** Sample data for the "Juin 2026" retrait so the mockup reads like a real tool. */
export const SAMPLE_PRODUCTS: ExpiredProduct[] = [
  {
    id: '1',
    name: 'Amoxicilline 1g cpr',
    cip: '3400930012345',
    section: 'Antibiotiques',
    quantity: 3,
    expiry: '2026-06',
    status: 'expired',
    addedBy: 'VK',
  },
  {
    id: '2',
    name: 'Doliprane 1000mg cpr',
    cip: '3400930067891',
    section: 'Antalgiques',
    quantity: 8,
    expiry: '2026-06',
    status: 'soon',
    addedBy: 'VK',
  },
  {
    id: '3',
    name: 'Insuline Lantus stylo',
    cip: '3400930055512',
    section: 'Réfrigérateur',
    quantity: 2,
    expiry: '2026-06',
    status: 'expired',
    addedBy: 'AM',
  },
  {
    id: '4',
    name: 'Collyre Vismed unidose',
    cip: '3400930088123',
    section: 'Ophtalmologie',
    quantity: 12,
    expiry: '2026-06',
    status: 'soon',
    addedBy: 'VK',
  },
  {
    id: '5',
    name: 'Biafine émulsion 93g',
    cip: '3400930033450',
    section: 'Dermatologie',
    quantity: 1,
    expiry: '2026-06',
    status: 'resolved',
    addedBy: 'AM',
  },
  {
    id: '6',
    name: 'Spasfon Lyoc',
    cip: '3400930071234',
    section: 'Antalgiques',
    quantity: 5,
    expiry: '2026-06',
    status: 'ok',
    addedBy: 'VK',
  },
  {
    id: '7',
    name: 'Augmentin 500mg sachet',
    cip: '3400930014567',
    section: 'Antibiotiques',
    quantity: 4,
    expiry: '2026-07',
    status: 'soon',
    addedBy: 'VK',
  },
  {
    id: '8',
    name: 'Voltarène gel 1%',
    cip: '3400930029087',
    section: 'Dermatologie',
    quantity: 6,
    expiry: '2026-07',
    status: 'ok',
    addedBy: 'AM',
  },
  {
    id: '9',
    name: 'Levothyrox 100µg',
    cip: '3400930044111',
    section: 'Comptoir',
    quantity: 9,
    expiry: '2026-05',
    status: 'expired',
    addedBy: 'AM',
  },
  {
    id: '10',
    name: 'Ostéocynésine granules',
    cip: '3400930090234',
    section: 'Homéopathie',
    quantity: 3,
    expiry: '2026-05',
    status: 'resolved',
    addedBy: 'VK',
  },
]

/** Returns the sorted list of distinct months present in the data (ascending). */
export function availableMonths(products: ExpiredProduct[]): string[] {
  return Array.from(new Set(products.map((p) => p.expiry))).sort()
}

/** Builds a CSV string for the given products. */
export function toCsv(products: ExpiredProduct[]): string {
  const header = [
    'Produit',
    'CIP',
    'Rayon',
    'Quantite',
    'Expiration',
    'Statut',
    'Technicien',
  ]
  const rows = products.map((p) => [
    p.name,
    p.cip,
    p.section,
    String(p.quantity),
    p.expiry,
    STATUS_META[p.status].label,
    p.addedBy,
  ])
  return [header, ...rows]
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export const STATUS_META: Record<
  ProductStatus,
  { label: string; icon: string; bg: string; fg: string }
> = {
  expired: {
    label: 'Expiré',
    icon: 'error',
    bg: 'var(--md-sys-color-error-container)',
    fg: 'var(--md-sys-color-on-error-container)',
  },
  soon: {
    label: 'Bientôt',
    icon: 'schedule',
    bg: 'var(--md-sys-color-warning-container)',
    fg: 'var(--md-sys-color-on-warning-container)',
  },
  ok: {
    label: 'Ciblé',
    icon: 'inventory_2',
    bg: 'var(--md-sys-color-secondary-container)',
    fg: 'var(--md-sys-color-on-secondary-container)',
  },
  resolved: {
    label: 'Résolu',
    icon: 'task_alt',
    bg: 'var(--md-sys-color-success-container)',
    fg: 'var(--md-sys-color-on-success-container)',
  },
}

export function formatExpiry(iso: string): string {
  const months = [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ]
  const [y, m] = iso.split('-')
  return `${months[Number(m) - 1]} ${y}`
}
