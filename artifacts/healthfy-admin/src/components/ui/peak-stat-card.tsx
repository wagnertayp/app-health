import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import "./peak-stat-card.css";

export function PeakStatCard({ label, value, hint, icon: Icon, testId, index = 0 }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; testId?: string; index?: number;
}) {
  return (
    <div className="peak-stat" data-testid={testId} style={{ animationDelay: `${index * 45}ms` }}>
      <div className="peak-stat__head">
        <span className="peak-stat__label" title={label}>{label}</span>
        {Icon && <span className="peak-stat__icon"><Icon className="h-3.5 w-3.5" /></span>}
      </div>
      <div className="peak-stat__value">{value}</div>
      {hint && <div className="peak-stat__hint">{hint}</div>}
    </div>
  );
}
