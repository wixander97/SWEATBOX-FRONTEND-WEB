export default function CoachesPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-card rounded-xl border border-border p-6 text-center group hover:border-sweat transition">
        <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 overflow-hidden border-2 border-transparent group-hover:border-sweat transition">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ui-avatars.com/api/?name=Raka&background=random"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <h3 className="font-bold text-xl text-white">Coach Raka</h3>
        <p className="text-gray-400 text-sm mb-4">Boxing Specialist</p>
        <div className="flex justify-center gap-2 mb-6">
          <span className="bg-gray-800 px-3 py-1 rounded-full text-xs">
            Puri Indah
          </span>
          <span className="bg-gray-800 px-3 py-1 rounded-full text-xs">PIK</span>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-left">
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Classes</p>
            <p className="font-bold text-lg text-white">
              24 <span className="text-xs font-normal">/mo</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Rating</p>
            <p className="font-bold text-lg text-sweat">
              4.9 <i className="fas fa-star text-xs" aria-hidden />
            </p>
          </div>
        </div>
        <button
          type="button"
          className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm border border-border transition"
        >
          View Schedule
        </button>
      </div>
      <div className="bg-card rounded-xl border border-border p-6 text-center group hover:border-sweat transition">
        <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 overflow-hidden border-2 border-transparent group-hover:border-sweat transition">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ui-avatars.com/api/?name=Sarah&background=random"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <h3 className="font-bold text-xl text-white">Coach Sarah</h3>
        <p className="text-gray-400 text-sm mb-4">HIIT &amp; Conditioning</p>
        <div className="flex justify-center gap-2 mb-6">
          <span className="bg-gray-800 px-3 py-1 rounded-full text-xs">
            Puri Indah
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-left">
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Classes</p>
            <p className="font-bold text-lg text-white">
              30 <span className="text-xs font-normal">/mo</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Rating</p>
            <p className="font-bold text-lg text-sweat">
              5.0 <i className="fas fa-star text-xs" aria-hidden />
            </p>
          </div>
        </div>
        <button
          type="button"
          className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm border border-border transition"
        >
          View Schedule
        </button>
      </div>
    </div>
  );
}
