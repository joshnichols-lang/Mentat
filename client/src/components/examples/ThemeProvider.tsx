import { ThemeProvider } from '../ThemeProvider'
import Dashboard from '@/pages/Dashboard'

export default function ThemeProviderExample() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  )
}
