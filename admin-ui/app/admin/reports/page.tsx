import { staffLogs } from "@/lib/mock-data";

export default function ReportsPage() {
  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="tab-btn active cursor-pointer bg-card px-6 py-4 rounded-xl border border-sweat text-sweat font-bold sm:w-1/4 text-center hover:bg-white/5">
          <i className="fas fa-users mb-2 block text-2xl" aria-hidden />
          Member Attendance
        </div>
        <div className="tab-btn cursor-pointer bg-card px-6 py-4 rounded-xl border border-border text-gray-400 font-bold sm:w-1/4 text-center hover:bg-white/5 hover:text-white">
          <i className="fas fa-id-card-alt mb-2 block text-2xl" aria-hidden />
          Staff Clock-in/out
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h4 className="font-bold text-lg text-white">Daily Staff Log (Today)</h4>
          <span className="text-sm text-gray-400">Total: 3 Present</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm text-gray-400">
          <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Staff Name</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Validation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {staffLogs.map((s) => (
              <tr key={s.id} className="table-row transition">
                <td className="px-6 py-4 font-mono text-white">{s.time}</td>
                <td className="px-6 py-4 font-bold text-white">{s.name}</td>
                <td className="px-6 py-4">{s.role}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-2">
                    <i
                      className="fas fa-map-marker-alt text-xs text-sweat"
                      aria-hidden
                    />
                    {s.location}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-green-500 font-bold">
                    CLOCK {s.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs border border-green-500/20">
                      GPS: OK
                    </span>
                    <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs border border-green-500/20">
                      FACE: OK
                    </span>
                    <a href="#" className="text-xs text-blue-400 underline ml-2">
                      View Photo
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
