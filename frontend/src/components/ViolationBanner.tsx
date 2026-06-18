import { AlertTriangle } from "lucide-react";

import type { Violation } from "@/lib/types";

export function ViolationBanner({ violations }: { violations: Violation[] }) {
  if (!violations.length) return null;
  return (
    <div className="space-y-2">
      {violations.map((v, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-destructive">{v.message}</p>
            {v.suggestion && <p className="text-muted-foreground">{v.suggestion}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
