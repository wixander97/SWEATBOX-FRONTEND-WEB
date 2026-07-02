"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAuthTokenLocal } from "@/lib/auth/client-fetch";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string; message?: string };
    setLoading(false);

    if (!res.ok) {
      setError(payload.message || "Login gagal");
      return;
    }

    const nextPath =
      new URLSearchParams(window.location.search).get("next") ||
      "/admin/dashboard";
    setAuthTokenLocal(payload.token ?? "");
    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-dark text-white flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
      <section className="w-full max-w-md bg-card border border-border rounded-xl p-5 sm:p-8">
        <h1 className="font-display text-xl sm:text-2xl font-bold mb-2">Login Admin</h1>
        <p className="text-sm text-gray-400 mb-5 sm:mb-6">
          Masuk untuk mengakses dashboard Sweatbox.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-sidebar border border-border text-white px-3 sm:px-4 py-3 rounded-lg focus:outline-none focus:border-sweat text-sm sm:text-base"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-sidebar border border-border text-white px-3 sm:px-4 py-3 pr-11 rounded-lg focus:outline-none focus:border-sweat text-sm sm:text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white transition"
                tabIndex={-1}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sweat text-black font-bold py-3 rounded-lg hover:bg-yellow-400 transition disabled:opacity-70 text-sm sm:text-base"
          >
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
