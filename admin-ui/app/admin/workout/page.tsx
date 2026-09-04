export default function WorkoutPage() {
  return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <div className="w-20 h-20 bg-fg/5 rounded-full flex items-center justify-center mx-auto mb-4 text-accent-ink text-3xl">
        <i className="fas fa-running" aria-hidden />
      </div>
      <h3 className="text-2xl font-bold text-fg mb-2">Workout Database</h3>
      <p className="text-muted max-w-md mx-auto mb-6">
        Module for adding workout movement references, YouTube video links,
        and training programs for the member app.
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
