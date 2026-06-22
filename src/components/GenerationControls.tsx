/**
 * components/GenerationControls.tsx
 * ---------------------------------------------------------------------------
 * All user-facing generation parameters: model selection, prompt, negative
 * prompt, duration, aspect ratio, seed, CFG scale, and target total duration.
 * ---------------------------------------------------------------------------
 */

import { useMemo, useCallback } from "react";
import type { ModelDescriptor, ApiKeys } from "../types";
import { MODEL_REGISTRY } from "../constants";

export interface GenerationSettings {
  selectedModelId: string;
  prompt: string;
  negativePrompt: string;
  durationPerClip: number;
  aspectRatio: string;
  seed: string; /* string so the input can be empty (random) */
  cfgScale: number;
  targetTotalDuration: number;
}

interface Props {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
  apiKeys: ApiKeys;
}

export default function GenerationControls({
  settings,
  onChange,
  apiKeys,
}: Props) {
  /**
   * Filter models to only those whose provider has a configured API key.
   * If no keys are set, show all models so the user knows what is available.
   */
  const availableModels: ModelDescriptor[] = useMemo(() => {
    const hasAnyKey = Object.values(apiKeys).some(Boolean);
    if (!hasAnyKey) return MODEL_REGISTRY;
    return MODEL_REGISTRY.filter((m) => {
      const key = apiKeys[m.provider];
      return Boolean(key);
    });
  }, [apiKeys]);

  const selectedModel = useMemo(
    () =>
      MODEL_REGISTRY.find((m) => m.id === settings.selectedModelId) ||
      MODEL_REGISTRY[0],
    [settings.selectedModelId]
  );

  const update = useCallback(
    (partial: Partial<GenerationSettings>) => {
      onChange({ ...settings, ...partial });
    },
    [settings, onChange]
  );

  const segmentCount = useMemo(() => {
    const max = selectedModel.maxDurationSeconds;
    return Math.ceil(settings.targetTotalDuration / max);
  }, [selectedModel, settings.targetTotalDuration]);

  return (
    <div className="space-y-4">
      {/* Model Selector */}
      <div>
        <label
          htmlFor="model-select"
          className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
        >
          Model
        </label>
        <select
          id="model-select"
          value={settings.selectedModelId}
          onChange={(e) => {
            const model = MODEL_REGISTRY.find((m) => m.id === e.target.value);
            if (model) {
              update({
                selectedModelId: model.id,
                durationPerClip: Math.min(
                  settings.durationPerClip,
                  model.maxDurationSeconds
                ),
                aspectRatio: model.aspectRatios.includes(settings.aspectRatio)
                  ? settings.aspectRatio
                  : model.aspectRatios[0],
              });
            }
          }}
          className="block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-600">{selectedModel.note}</p>
      </div>

      {/* Prompt */}
      <div>
        <label
          htmlFor="prompt"
          className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
        >
          Prompt
        </label>
        <textarea
          id="prompt"
          rows={3}
          value={settings.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="Describe the motion, camera movement, and scene action..."
          className="block w-full resize-y rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      {/* Negative Prompt (if model supports it) */}
      {selectedModel.supportsNegativePrompt && (
        <div>
          <label
            htmlFor="neg-prompt"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
          >
            Negative Prompt
          </label>
          <input
            id="neg-prompt"
            type="text"
            value={settings.negativePrompt}
            onChange={(e) => update({ negativePrompt: e.target.value })}
            placeholder="blur, distort, low quality, watermark"
            className="block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      )}

      {/* Duration / Aspect / Seed row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Duration per clip */}
        <div>
          <label
            htmlFor="clip-dur"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
          >
            Clip (s)
          </label>
          <input
            id="clip-dur"
            type="number"
            min={1}
            max={selectedModel.maxDurationSeconds}
            step={1}
            value={settings.durationPerClip}
            onChange={(e) =>
              update({
                durationPerClip: Math.max(
                  1,
                  Math.min(
                    selectedModel.maxDurationSeconds,
                    Number(e.target.value) || 5
                  )
                ),
              })
            }
            className="block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* Aspect ratio */}
        <div>
          <label
            htmlFor="aspect"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
          >
            Ratio
          </label>
          <select
            id="aspect"
            value={settings.aspectRatio}
            onChange={(e) => update({ aspectRatio: e.target.value })}
            className="block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {selectedModel.aspectRatios.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Seed */}
        <div>
          <label
            htmlFor="seed"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
          >
            Seed
          </label>
          <input
            id="seed"
            type="text"
            value={settings.seed}
            onChange={(e) => update({ seed: e.target.value })}
            placeholder="Random"
            disabled={!selectedModel.supportsSeed}
            className="block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-40"
          />
        </div>

        {/* CFG Scale */}
        <div>
          <label
            htmlFor="cfg"
            className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
          >
            CFG
          </label>
          <input
            id="cfg"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={settings.cfgScale}
            onChange={(e) =>
              update({
                cfgScale: Math.max(
                  0,
                  Math.min(1, Number(e.target.value) || 0.5)
                ),
              })
            }
            className="block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Total target duration */}
      <div>
        <label
          htmlFor="total-dur"
          className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500"
        >
          Total Target Duration (seconds)
        </label>
        <input
          id="total-dur"
          type="number"
          min={1}
          max={600}
          step={1}
          value={settings.targetTotalDuration}
          onChange={(e) =>
            update({
              targetTotalDuration: Math.max(
                1,
                Math.min(600, Number(e.target.value) || 10)
              ),
            })
          }
          className="block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <p className="mt-1 text-xs text-neutral-600">
          Will auto-segment into {segmentCount} clip
          {segmentCount !== 1 ? "s" : ""} of up to{" "}
          {selectedModel.maxDurationSeconds}s each, then auto-stitch.
        </p>
      </div>
    </div>
  );
}
