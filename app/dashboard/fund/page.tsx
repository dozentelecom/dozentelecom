export default function Fund() {
  return (
    <main className="shell page">
      <div
        className="card"
        style={{ maxWidth: 560 }}
      >
        <h1>Fund wallet</h1>

        <p className="muted">
          Enter the amount you want to fund. Your applicable
          funding fee will be calculated automatically.
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
            step="1"
            required
            placeholder="Amount in ₦"
          />

          <button
            className="btn primary"
            type="submit"
          >
            Continue to Flutterwave
          </button>
        </form>
      </div>
    </main>
  );
}