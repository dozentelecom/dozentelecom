"use client";

export default function PrintReceiptButton() {
  return (
    <button
      type="button"
      className="btn primary"
      onClick={() => window.print()}
    >
      Print Receipt
    </button>
  );
}