"use client";

import { useRole } from "@/contexts/role-context";

export function PayrollView() {
  const { currentRole } = useRole();

  if (currentRole !== "owner") {
    return (
      <div className="bg-card rounded-xl border border-dashed border-red-500 p-6 sm:p-12 text-center">
        <i className="fas fa-lock text-red-500 text-5xl mb-4" aria-hidden />
        <h3 className="text-2xl font-bold text-white mb-2">Access Denied</h3>
        <p className="text-gray-400">
          Anda tidak memiliki izin untuk melihat halaman Keuangan &amp; Payroll.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h4 className="font-bold text-lg">Payroll Periode: Februari 2024</h4>
        <button
          type="button"
          className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
        >
          <i className="fas fa-download mr-2" aria-hidden />
          Export Report
        </button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm text-gray-400">
        <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
          <tr>
            <th className="px-6 py-4">Coach Name</th>
            <th className="px-6 py-4">Total Classes</th>
            <th className="px-6 py-4">Total Members</th>
            <th className="px-6 py-4">Est. Payout</th>
            <th className="px-6 py-4 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr className="table-row transition">
            <td className="px-6 py-4 font-bold text-white">Coach Raka</td>
            <td className="px-6 py-4">24</td>
            <td className="px-6 py-4">350</td>
            <td className="px-6 py-4 font-mono text-sweat">Rp 4.500.000</td>
            <td className="px-6 py-4 text-right">
              <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded text-xs font-bold border border-yellow-500/20">
                Pending
              </span>
            </td>
          </tr>
          <tr className="table-row transition">
            <td className="px-6 py-4 font-bold text-white">Coach Sarah</td>
            <td className="px-6 py-4">30</td>
            <td className="px-6 py-4">420</td>
            <td className="px-6 py-4 font-mono text-sweat">Rp 5.200.000</td>
            <td className="px-6 py-4 text-right">
              <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded text-xs font-bold border border-yellow-500/20">
                Pending
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
