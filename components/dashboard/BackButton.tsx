"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn back-btn"
      onClick={() => router.back()}
    >
      ← Back
    </button>
  );
}