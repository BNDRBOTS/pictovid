/**
 * components/PipelineStatus.tsx
 * ---------------------------------------------------------------------------
 * Displays the real-time state of the generation pipeline:
 * - Per-segment status indicators
 * - Progress logs
 * - Error messages
 * - Stitching status
 * ---------------------------------------------------------------------------
 */

import type { VideoSegment, PipelineState } from "../types";

interface Props {
  state: PipelineState;
  logs: string[];
}

/**
 * Map segment status to a visual indicator.
 */
function statusBadge(status: VideoSegment["status"]): {
  color: string;
  text: string;
} {
  switch (status) {
    case "queued":
      return { color: "bg-neutral-600", text: "Queued" };
    case "submitting":
      return { color: "bg-amber-600", text: "Submitting" };
    case "processing":
      return { color: "bg-sky-600 animate-pulse", text: "Processing" };
    case "succeeded":
      return { color: "bg-green-600", text: "Done" };
    case "failed":
      return { color: "bg-red-600", text: "Failed" };
    case "cancelled":
      return { color: "bg-neutral-500", text: "Cancelled" };
    default:
      return { color: "bg-neutral-600", text: "Unknown" };
  }
}

export default function PipelineStatus({ state, logs }: Props) {
  if (state.status === "idle") return null;

  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      {/* Pipeline-level status */}
      <div className="flex items-center gap-2">
        {(state.status === "generating" || state.status === "stitching") && (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        )}
        <span className="text-sm font-medium text-white">
          {state.status === "generating" && "Generating segments..."}
          {state.status === "stitching" && "Stitching segments..."}
          {state.status === "complete" && "Pipeline complete."}
          {state.status === "error" && "Pipeline encountered an error."}
        </span>
      </div>

      {/* Global error */}
      {state.error && (
        <div className="rounded border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          {state.error}
        </div>
      )}

      {/* Segment progress */}
      {state.segments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Segments
          </p>
          <div className="flex flex-wrap gap-2">
            {state.segments.map((seg) => {
              const badge = statusBadge(seg.status);
              return (
                <div
                  key={seg.id}
                  className="flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800 px-2 py-1"
                  title={seg.error || ""}
                >
                  <div className={`h-2 w-2 rounded-full ${badge.color}`} />
                  <span className="text-xs text-neutral-300">
                    #{seg.index + 1}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {badge.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Logs console */}
      {logs.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Logs
          </p>
          <div className="max-h-32 overflow-y-auto rounded border border-neutral-800 bg-black p-2 font-mono text-xs text-neutral-400">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
