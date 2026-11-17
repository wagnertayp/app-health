import "./_group.css";
import { CalendarPreview, CalendarToolbar, Filters } from "./_parts";

export function Current() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Multi-agenda</h1>
          <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">＋ Compromisso</button>
        </header>
        <CalendarToolbar />
        <div className="mb-4"><Filters /></div>
        <CalendarPreview />
      </div>
    </main>
  );
}
