/**
 * hooks/usePipeline.ts
 * ---------------------------------------------------------------------------
 * Core React hook that manages the entire generation pipeline state.
 * Wraps the orchestrator with React-friendly state management.
 * ---------------------------------------------------------------------------
 */

import { useState, useCallback, useRef } from "react";
import type {
  PipelineState,
  PipelineStatus,
  VideoSegment,
  GenerationParams,
  ApiKeys,
} from "../types";
import { runPipeline } from "../api/orchestrator";

const INITIAL_STATE: PipelineState = {
  status: "idle",
  segments: [],
  stitchedUrl: null,
  targetDurationSeconds: 10,
  error: null,
};

export interface UsePipelineReturn {
  state: PipelineState;
  /** Log messages from the current generation. */
  logs: string[];
  /** Start a new pipeline run. Resets previous state. */
  start: (
    params: GenerationParams,
    targetDuration: number,
    apiKeys: ApiKeys
  ) => void;
  /** Cancel an in-progress pipeline. */
  cancel: () => void;
  /** Reset all state back to idle. */
  reset: () => void;
}

export function usePipeline(): UsePipelineReturn {
  const [state, setState] = useState<PipelineState>(INITIAL_STATE);
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  /* -- Helpers to immutably update segment arrays ---------------------- */

  const upsertSegment = useCallback((seg: VideoSegment) => {
    setState((prev) => {
      const idx = prev.segments.findIndex((s) => s.id === seg.id);
      const next = [...prev.segments];
      if (idx >= 0) {
        next[idx] = seg;
      } else {
        next.push(seg);
      }
      return { ...prev, segments: next };
    });
  }, []);

  const setStatus = useCallback((status: PipelineStatus) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  /* -- Start ----------------------------------------------------------- */

  const start = useCallback(
    (params: GenerationParams, targetDuration: number, apiKeys: ApiKeys) => {
      /* Abort any prior run */
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      /* Reset state */
      setState({
        status: "generating",
        segments: [],
        stitchedUrl: null,
        targetDurationSeconds: targetDuration,
        error: null,
      });
      setLogs([]);

      /* Fire and forget -- the callbacks drive state updates */
      runPipeline(
        params,
        targetDuration,
        apiKeys,
        {
          onSegmentCreated: (seg) => upsertSegment(seg),
          onSegmentUpdated: (seg) => upsertSegment(seg),
          onStitchStart: () => setStatus("stitching"),
          onStitchComplete: (url) => {
            setState((prev) => ({
              ...prev,
              status: "complete",
              stitchedUrl: url,
            }));
          },
          onError: (error) => {
            setState((prev) => ({
              ...prev,
              status: "error",
              error,
            }));
          },
          onProgress: (_segId, msg) => {
            setLogs((prev) => [...prev.slice(-99), msg]);
          },
        },
        controller.signal
      ).catch((err: unknown) => {
        if (controller.signal.aborted) return; /* Expected on cancel */
        const message =
          err instanceof Error ? err.message : "Pipeline failed unexpectedly.";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }));
      });
    },
    [upsertSegment, setStatus]
  );

  /* -- Cancel ---------------------------------------------------------- */

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus("idle");
  }, [setStatus]);

  /* -- Reset ----------------------------------------------------------- */

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState(INITIAL_STATE);
    setLogs([]);
  }, []);

  return { state, logs, start, cancel, reset };
}
