
"use client";

import Link from "next/link";
import { useState } from "react";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Unexpected server response. Please try again."
        );
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.error || "Login failed. Check your login details."
        );
        return;
      }

      const destination =
        typeof data.redirect === "string" &&
        data.redirect.startsWith("/") &&
        !data.redirect.startsWith("//")
          ? data.redirect
          : "/dashboard";

      window.location.assign(destination);

    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

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

        <form
          method="POST"
          action="/api/auth/login"
          onSubmit={handleLogin}
        >
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
            disabled={loading}
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
              disabled={loading}
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword((value) => !value)
              }
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                background: "#fff0f0",
                border: "1px solid #efb5b5",
                color: "#b42318",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 18,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn primary"
              type="submit"
              disabled={loading}
              style={{
                flex: "1 1 140px",
                minWidth: 140,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <Link
              href="/register"
              className="btn"
              style={{
                flex: "1 1 140px",
                minWidth: 140,
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
              marginTop: 14,
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
