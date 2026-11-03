
import Link from "next/link";

const items: Array<[string, string, string]> = [
  ["📱", "Airtime", "Easy access."],
  ["📶", "Data", "Affordable plans across all networks."],
  ["⚡", "Electricity", "Verify meter before payment."],
  ["📺", "Cable TV", "Verify smartcard and select package."],
  ["🎓", "Education", "Live education pin."],
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">
          Dozen<span>telecom</span>
        </div>

        <div className="links">
          <Link href="/services">Services</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/pricing">Data Prices</Link>
          <Link href="/login">Login</Link>
          <Link href="/register">Register</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="muted">
          Premium VTU • Wallet • Payments
        </div>

        <h1>
          Simple. Fast.
          <br />
          Built for everyday Nigeria.
        </h1>

        <p>
          One secure wallet for airtime, data, electricity,
          cable TV and educational pins.
        </p>

        <div className="actions">
          <Link className="btn primary" href="/register">
            Create account
          </Link>

          <Link className="btn" href="/pricing">
            View Data Prices
          </Link>

          <Link className="btn" href="/services">
            View services
          </Link>
        </div>
      </section>

      <div className="grid">
        {items.map(([icon, name, description]) => (
          <div className="card" key={name}>
            <div style={{ fontSize: 30 }}>{icon}</div>
            <h3>{name}</h3>
            <p className="muted">{description}</p>
          </div>
        ))}
      </div>

      <footer className="footer">
        Customer support: ajibadeayodeji07@gmail.com • WhatsApp support
        available.
      </footer>
    </main>
  );
}
