import type { Metadata } from 'next'
import '@elira/app/globals.css'
import './styles/dashboard.css'
import './globals.css'
import AppProviders from './providers'
import DashboardNavbar from '@/components/layout/dashboard-navbar'

export const metadata: Metadata = {
  title: {
    default: 'Dashboard',
    template: '%s | Evict',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <DashboardNavbar />
          <div className="page">{children}</div>
        </AppProviders>
      </body>
    </html>
  )
}
