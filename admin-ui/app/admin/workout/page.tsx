export default function WorkoutPage() {
  return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-sweat text-3xl">
        <i className="fas fa-running" aria-hidden />
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">Workout Database</h3>
      <p className="text-gray-400 max-w-md mx-auto mb-6">
        Modul untuk menambahkan referensi gerakan workout, link video YouTube,
        dan program latihan untuk aplikasi member.
      </p>
      <button
        type="button"
        className="bg-sweat text-black font-bold px-6 py-3 rounded-lg shadow-lg hover:bg-yellow-400 transition"
      >
        <i className="fas fa-plus mr-2" aria-hidden />
        Input New Workout
      </button>
    </div>
  );
}
