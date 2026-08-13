import Link from 'next/link'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/login', label: 'Login' },
  { href: '/platform', label: 'Platform' },
  { href: '/platform/setup', label: 'Setup' },
  { href: '/platform/orders', label: 'Orders' },
  { href: '/platform/analytics', label: 'Analytics' },
  { href: '/admin', label: 'Admin' },
  { href: '/admin/analytics', label: 'Platform Analytics' },
]

export function TopNav() {
  return (
    <header className="global-nav-shell">
      <nav className="global-nav" aria-label="Primary">
        <Link className="global-nav-brand" href="/">
          Waiter AI
        </Link>
        <div className="global-nav-links">
          {navLinks.map((link) => (
            <Link key={link.href} className="global-nav-link" href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}