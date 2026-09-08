"use client";

import Link from "next/link";
import { useState } from "react";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="shell page">
      <div
        className="card"
        style={{
          maxWidth: 520,
          margin: "30px auto",
        }}
      >
        <h1>Create account</h1>

        <p className="muted">
          Create your account and set up your 4-digit transaction PIN.
        </p>

        <form action="/api/auth/register" method="post">
          <label className="label">
            Full name
          </label>

          <input
            className="input"
            name="name"
            type="text"
            autoComplete="name"
            required
          />

          <label className="label">
            Email
          </label>

          <input
            className="input"
            name="email"
            type="email"
            autoComplete="email"
            required
          />

          <label className="label">
            Phone
          </label>

          <input
            className="input"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="08143140831"
            required
          />

          <label className="label">
            Password
          </label>

          <div className="password-wrapper">
            <input
              className="input password-input"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              autoComplete="new-password"
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword((v) => !v)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Create Account + Login */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "18px",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn primary"
              type="submit"
              style={{
                flex: 1,
                minWidth: "140px",
              }}
            >
              Create account
            </button>

            <Link
              href="/login"
              className="btn"
              style={{
                flex: 1,
                minWidth: "140px",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              Login
            </Link>
          </div>

          {/* Forgot Password */}
          <Link
            href="/forgot-password"
            className="forgot-password"
            style={{
              display: "block",
              marginTop: "14px",
              textAlign: "center",
            }}
          >
            Forgot password?
          </Link>
        </form>
      </div>
    </main>
  );
}