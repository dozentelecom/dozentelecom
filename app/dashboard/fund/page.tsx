export default function Fund() {
  return (
    <main className="shell page">
      <div
        className="card"
        style={{ maxWidth: 560 }}
      >
        <h1>Fund wallet</h1>

        <p className="muted">
          The applicable funding fee is calculated automatically
          from your current admin-configured funding rate.
        </p>

        <form
          action="/api/wallet/fund"
          method="post"
        >
          <input
            className="input"
            name="amount"
            type="number"
            min="100"
            required
            placeholder="Amount"
          />

          <button
            className="btn primary"
            type="submit"
          >
            Continue to Paystack
          </button>
        </form>
      </div>
    </main>
  );
}