"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, CircleOff, Database, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DatabaseHealth } from "@/lib/supabase/health";
import { cn } from "@/lib/utils";

type ViewState =
  | { status: "loading" }
  | { status: "connected"; project: string }
  | { status: "disconnected"; error: string }
  | { status: "error"; error: string };

export function DatabaseStatus() {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadStatus() {
      try {
        const response = await fetch("/api/health/database", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Health endpoint returned HTTP ${response.status}.`);
        }

        const health = (await response.json()) as DatabaseHealth;

        if (health.connected && health.project) {
          setState({ status: "connected", project: health.project });
        } else if (health.error?.includes("not configured")) {
          setState({ status: "disconnected", error: health.error });
        } else {
          setState({ status: "error", error: health.error ?? "Database health check failed." });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Database health check failed.",
        });
      }
    }

    void loadStatus();
    return () => controller.abort();
  }, []);

  const presentation = getPresentation(state);
  const Icon = presentation.icon;

  return (
    <Card className="w-full sm:w-72">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", presentation.iconClass)}>
          <Icon className={cn("size-4", state.status === "loading" && "animate-spin")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <Database className="size-3.5" />
              Database
            </div>
            <Badge variant="outline" className={presentation.badgeClass}>
              {presentation.label}
            </Badge>
          </div>
          <div className="mt-2">
            <div className="text-xs text-muted-foreground">Project ID</div>
            <div className="mt-0.5 truncate text-sm font-semibold">
              {state.status === "connected" ? state.project : "Not available"}
            </div>
          </div>
          {state.status === "error" ? (
            <p className="mt-2 text-xs leading-5 text-red-700">{state.error}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getPresentation(state: ViewState) {
  if (state.status === "loading") {
    return {
      label: "Loading",
      icon: Loader2,
      iconClass: "bg-slate-100 text-slate-600",
      badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  if (state.status === "connected") {
    return {
      label: "Connected",
      icon: CircleCheck,
      iconClass: "bg-emerald-100 text-emerald-700",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (state.status === "disconnected") {
    return {
      label: "Disconnected",
      icon: CircleOff,
      iconClass: "bg-slate-100 text-slate-600",
      badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  return {
    label: "Error",
    icon: CircleAlert,
    iconClass: "bg-red-100 text-red-700",
    badgeClass: "border-red-200 bg-red-50 text-red-800",
  };
}
