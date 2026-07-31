import type React from 'react'

/**
 * JSX typings for Material Web (`<md-*>`) custom elements.
 *
 * These are Lit custom elements, not React components, so we type them
 * permissively: standard HTML attributes plus arbitrary kebab-case props
 * and lowercase DOM event handlers (onchange/oninput/onclick/onclosed).
 * This avoids per-tag maintenance while keeping `md-*` tags type-safe to use.
 */
type MdCustomElement = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement> & {
    [attr: string]: unknown
    class?: string
    slot?: string
    value?: string | number
    selected?: boolean
    checked?: boolean
    disabled?: boolean
    onchange?: (event: Event) => void
    oninput?: (event: Event) => void
    onclick?: (event: Event) => void
    onclosed?: (event: Event) => void
  },
  HTMLElement
>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [tag: `md-${string}`]: MdCustomElement
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [tag: `md-${string}`]: MdCustomElement
    }
  }
}

export {}
