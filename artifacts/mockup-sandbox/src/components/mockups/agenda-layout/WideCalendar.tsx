import "./_group.css";
import { CalendarPreview, CalendarToolbar, Filters } from "./_parts";

export function WideCalendar() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Multi-agenda</h1>
          <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">＋ Compromisso</button>
        </header>
        <CalendarToolbar />
        <div className="grid min-w-0 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="min-w-0"><Filters compact /></aside>
          <section className="min-w-0"><CalendarPreview wide /></section>
        </div>
      </div>
    </main>
  );
}
