'use client'

import { ThemeToggle } from '@/components/theme-toggle'

export function AppBar() {
  return (
    <header className="appbar">
      <div className="appbar-inner">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">
            <md-icon>eco</md-icon>
          </span>
          <span className="brand-text">
            <h1 className="brand-title md-typescale-title-large">
              Gestion des Expirés
            </h1>
            <span className="brand-sub md-typescale-body-small">
              Plateforme de contrôle interne du laboratoire
            </span>
          </span>
        </div>

        <div className="appbar-actions">
          <span className="pharma-id">
            <span className="name md-typescale-label-medium">
              Pharmacie test
            </span>
            <span className="mail md-typescale-body-small">
              victorkhoukaz@gmail.com
            </span>
          </span>

          <button className="month-pill md-typescale-label-large" type="button">
            <md-icon aria-hidden="true">calendar_month</md-icon>
            Juin 2026
          </button>

          <ThemeToggle />

          <md-outlined-button class="logout-btn">
            <md-icon slot="icon">logout</md-icon>
            Déconnexion
          </md-outlined-button>
        </div>
      </div>
    </header>
  )
}
