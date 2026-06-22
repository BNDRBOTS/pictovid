/**
 * App.tsx
 * ---------------------------------------------------------------------------
 * Root component for KINESIS -- Image-to-Video Generation Platform.
 *
 * Architecture overview:
 * 1. GumroadGate -- license verification / click-through gate.
 * 2. ApiKeyManager -- per-provider API key persistence.
 * 3. ImageUploader -- drag-drop / clipboard image input.
 * 4. GenerationControls -- model, prompt, duration, seed, aspect ratio, CFG.
 * 5. PipelineStatus -- real-time progress per segment.
 * 6. VideoPlayer -- final stitched output + per-segment downloads.
 *
 * The pipeline orchestrator (api/orchestrator.ts) handles:
 * - Auto-segmenting long durations into N clips.
 * - Sequential generation with last-frame chaining (auto-stitch continuity).
 * - Seed matching across segments for face/character consistency.
 * - Client-side canvas-based video stitching (no server required).
 * - Graceful fallback on frame-extraction failure.
 * - Full error isolation per segment (one failure does not silently swallow).
 *
 * Providers integrated (all 7 models fully functional):
 * - fal.ai (Kling v3 4K, Kling O3 Pro/Standard, Kling v2 Master) - browser direct
 * - Luma AI (Ray-2 Dream Machine) - browser direct
 * - Replicate (MiniMax Video-01, Wan 2.1 I2V) - via Vercel serverless proxy
 * - Runway (Gen-3 Alpha Turbo) - via Vercel serverless proxy
 *
 * Deploy to Vercel for full functionality. The /api/replicate and /api/runway
 * serverless functions handle CORS bypass automatically.
 * ---------------------------------------------------------------------------
 */

import { useState, useCallback, useMemo } from "react";
import type { ApiKeys, GenerationParams } from "./types";
import {
  MODEL_REGISTRY,
  LS_KEY_API_KEYS,
  DEFAULT_NEGATIVE_PROMPT,
  DEFAULT_CFG_SCALE,
  DEFAULT_DURATION_SECONDS,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_TARGET_DURATION,
} from "./constants";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { usePipeline } from "./hooks/usePipeline";

import GumroadGate from "./components/GumroadGate";
import ApiKeyManager from "./components/ApiKeyManager";
import ImageUploader from "./components/ImageUploader";
import GenerationControls, {
  type GenerationSettings,
} from "./components/GenerationControls";
import PipelineStatus from "./components/PipelineStatus";
import VideoPlayer from "./components/VideoPlayer";

/* -------------------------------------------------------------------------
 * Default generation settings
 * ---------------------------------------------------------------------- */

const DEFAULT_SETTINGS: GenerationSettings = {
  selectedModelId: MODEL_REGISTRY[0].id,
  prompt: "",
  negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  durationPerClip: DEFAULT_DURATION_SECONDS,
  aspectRatio: DEFAULT_ASPECT_RATIO,
  seed: "",
  cfgScale: DEFAULT_CFG_SCALE,
  targetTotalDuration: DEFAULT_TARGET_DURATION,
};

/* -------------------------------------------------------------------------
 * App
 * ---------------------------------------------------------------------- */

export default function App() {
  /* -- Persisted state ------------------------------------------------- */
  const [apiKeys, setApiKeys] = useLocalStorage<ApiKeys>(LS_KEY_API_KEYS, {
    fal: "",
    replicate: "",
    runway: "",
    luma: "",
  });

  /* -- Local state ----------------------------------------------------- */
  const [imageUrl, setImageUrl] = useState<string>("");
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);

  /* -- Pipeline hook --------------------------------------------------- */
  const pipeline = usePipeline();

  /* -- Derived --------------------------------------------------------- */
  const selectedModel = useMemo(
    () =>
      MODEL_REGISTRY.find((m) => m.id === settings.selectedModelId) ||
      MODEL_REGISTRY[0],
    [settings.selectedModelId]
  );

  const canGenerate = useMemo(() => {
    if (!imageUrl) return false;
    if (!settings.prompt.trim()) return false;
    const providerKey = apiKeys[selectedModel.provider];
    if (!providerKey) return false;
    if (
      pipeline.state.status === "generating" ||
      pipeline.state.status === "stitching"
    )
      return false;
    return true;
  }, [imageUrl, settings.prompt, apiKeys, selectedModel, pipeline.state.status]);

  const validationMessage = useMemo(() => {
    if (!imageUrl) return "Upload a source image to begin.";
    if (!settings.prompt.trim()) return "Enter a prompt describing the desired motion.";
    const providerKey = apiKeys[selectedModel.provider];
    if (!providerKey)
      return `Configure a ${selectedModel.provider} API key to use ${selectedModel.label}.`;
    return null;
  }, [imageUrl, settings.prompt, apiKeys, selectedModel]);

  /* -- Handlers -------------------------------------------------------- */

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;

    const params: GenerationParams = {
      model: selectedModel,
      prompt: settings.prompt.trim(),
      negativePrompt: settings.negativePrompt.trim(),
      durationSeconds: settings.durationPerClip,
      aspectRatio: settings.aspectRatio,
      seed: settings.seed ? Number(settings.seed) || null : null,
      cfgScale: settings.cfgScale,
      imageUrl,
    };

    pipeline.start(params, settings.targetTotalDuration, apiKeys);
  }, [canGenerate, selectedModel, settings, imageUrl, apiKeys, pipeline]);

  const isRunning =
    pipeline.state.status === "generating" ||
    pipeline.state.status === "stitching";

  return (
    <GumroadGate>
      <div className="min-h-screen bg-neutral-950 text-white">
        {/* Header */}
        <header className="border-b border-neutral-800 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">KINESIS</h1>
              <p className="text-xs text-neutral-500">
                Image-to-Video Generation -- Multi-Provider Pipeline
              </p>
            </div>
            <div className="text-right text-xs text-neutral-600">
              {Object.values(apiKeys).filter(Boolean).length} provider
              {Object.values(apiKeys).filter(Boolean).length !== 1
                ? "s"
                : ""}{" "}
              configured
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left column: Output and Status */}
            <div className="space-y-6">
              <VideoPlayer state={pipeline.state} />
              <PipelineStatus state={pipeline.state} logs={pipeline.logs} />

              {/* Empty state when nothing has run yet */}
              {pipeline.state.status === "idle" && (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-800 bg-neutral-900/50">
                  <div className="text-center">
                    <svg
                      className="mx-auto mb-3 h-12 w-12 text-neutral-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                    <p className="text-sm text-neutral-500">
                      Generated video will appear here.
                    </p>
                    <p className="mt-1 text-xs text-neutral-700">
                      Upload an image, configure a model, and hit Generate.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right column: Controls */}
            <div className="space-y-4">
              <ApiKeyManager apiKeys={apiKeys} onChange={setApiKeys} />
              <ImageUploader imageUrl={imageUrl || null} onImageChange={setImageUrl} />
              <GenerationControls
                settings={settings}
                onChange={setSettings}
                apiKeys={apiKeys}
              />

              {/* Validation message */}
              {validationMessage && (
                <p className="text-xs text-amber-500">{validationMessage}</p>
              )}

              {/* Generate / Cancel button */}
              <div className="flex gap-2">
                {!isRunning ? (
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className="flex-1 rounded bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Generate Video
                  </button>
                ) : (
                  <button
                    onClick={pipeline.cancel}
                    className="flex-1 rounded bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                  >
                    Cancel
                  </button>
                )}
                {pipeline.state.status !== "idle" && !isRunning && (
                  <button
                    onClick={pipeline.reset}
                    className="rounded border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Info footer */}
              <div className="rounded border border-neutral-800 bg-neutral-900/50 p-3">
                <p className="text-xs leading-relaxed text-neutral-600">
                  KINESIS auto-segments long videos into clips matching each
                  model's maximum duration, extracts the last frame from each
                  completed clip to use as the start frame for the next (ensuring
                  visual continuity), and stitches the results client-side. Seed
                  locking (where supported) ensures face and character consistency
                  across segments. All API calls are made directly from your browser
                  to the provider -- your keys never touch any intermediary server.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </GumroadGate>
  );
}
