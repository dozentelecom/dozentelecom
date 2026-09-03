"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "9px 14px",
        borderRadius: "9px",
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#111827",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#f9fafb";
        e.currentTarget.style.borderColor = "#d1d5db";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#ffffff";
        e.currentTarget.style.borderColor = "#e5e7eb";
      }}
    >
      <span style={{ fontSize: "18px", lineHeight: 1 }}>←</span>
      <span>Back</span>
    </button>
  );
}