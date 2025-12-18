import { Link, useLocation } from 'react-router-dom'
import {
  Ghost,
  LayoutDashboard,
  Search,
  Building2,
  Network,
  Tags,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Analyze', href: '/analyze', icon: Search },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Knowledge Graph', href: '/graph', icon: Network },
  { name: 'Taxonomy', href: '/taxonomy', icon: Tags },
]

export default function Layout({ children }) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-grid">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-72 glass hidden lg:block">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-ghost-500 to-ghost-700 flex items-center justify-center animate-float">
              <Ghost className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">GhostIntel</h1>
              <p className="text-xs text-ghost-300">Company Intelligence</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-ghost-600/30 text-white glow-border'
                      : 'text-ghost-300 hover:bg-ghost-600/20 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-ghost-400' : 'text-ghost-500 group-hover:text-ghost-400'}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-ghost-800/50">
            <div className="glass-light rounded-xl p-4">
              <p className="text-sm text-ghost-300">
                <span className="text-ghost-400 font-semibold">Deterministic</span> company intelligence with zero hallucination
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 glass">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ghost-500 to-ghost-700 flex items-center justify-center">
              <Ghost className="w-6 h-6 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">GhostIntel</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-ghost-600/20"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="px-4 pb-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-ghost-600/30 text-white'
                      : 'text-ghost-300 hover:bg-ghost-600/20'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="lg:pl-72 pt-20 lg:pt-0">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
