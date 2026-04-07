"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, role }),
    });

    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    setLoading(false);

    if (!res.ok) {
      setError(payload.message || "Register gagal");
      return;
    }

    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-dark text-white flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-card border border-border rounded-xl p-8">
        <h1 className="font-display text-2xl font-bold mb-2">Register Admin</h1>
        <p className="text-sm text-gray-400 mb-6">
          Daftarkan akun baru untuk akses dashboard.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
            >
              <option value="Owner">Owner / Manager</option>
              <option value="Admin">Admin / Staff</option>
            </select>
          </div>

          {error ? (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sweat text-black font-bold py-3 rounded-lg hover:bg-yellow-400 transition disabled:opacity-70"
          >
            {loading ? "Memproses..." : "Register"}
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-6 text-center">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-sweat hover:underline">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
