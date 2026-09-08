"use client";

import Link from "next/link";
import { useState } from "react";

export default function Login() {
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
        <h1>Login</h1>

        <p className="muted">
          Login with your email address or phone number.
        </p>

        <form action="/api/auth/login" method="post">
          <label className="label">
            Email or phone number
          </label>

          <input
            className="input"
            name="identifier"
            type="text"
            placeholder="Email or phone number"
            autoComplete="username"
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
              autoComplete="current-password"
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

          {/* Login + Create Account */}
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
              Login
            </button>

            <Link
              href="/register"
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
              Create account
            </Link>
          </div>

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