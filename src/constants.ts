/**
 * constants.ts
 * ---------------------------------------------------------------------------
 * Application-wide constants: model registry, default values, storage keys.
 * ---------------------------------------------------------------------------
 */

import type { ModelDescriptor } from "./types";

/* -------------------------------------------------------------------------
 * Model registry
 * ---------------------------------------------------------------------- */

export const MODEL_REGISTRY: ModelDescriptor[] = [
  /* -- fal.ai models --------------------------------------------------- */
  {
    id: "fal-kling-v3-pro-i2v",
    label: "Kling v3 4K Pro (fal.ai)",
    provider: "fal",
    endpoint: "fal-ai/kling-video/v3/4k/image-to-video",
    maxDurationSeconds: 15,
    supportsSeed: false,
    supportsNegativePrompt: true,
    aspectRatios: ["16:9", "9:16", "1:1"],
    note: "Top-tier 4K output with element references and multi-shot. Up to 15s per clip.",
  },
  {
    id: "fal-kling-o3-pro-i2v",
    label: "Kling O3 Pro (fal.ai)",
    provider: "fal",
    endpoint: "fal-ai/kling-video/o3/pro/image-to-video",
    maxDurationSeconds: 15,
    supportsSeed: false,
    supportsNegativePrompt: true,
    aspectRatios: ["16:9", "9:16", "1:1"],
    note: "O3-generation Kling model, high fidelity, ~318s gen time per 5s clip.",
  },
  {
    id: "fal-kling-o3-std-i2v",
    label: "Kling O3 Standard (fal.ai)",
    provider: "fal",
    endpoint: "fal-ai/kling-video/o3/standard/image-to-video",
    maxDurationSeconds: 15,
    supportsSeed: false,
    supportsNegativePrompt: true,
    aspectRatios: ["16:9", "9:16", "1:1"],
    note: "O3 Standard -- ~3x faster than Pro at a lower price.",
  },
  {
    id: "fal-kling-v2-master-i2v",
    label: "Kling v2 Master (fal.ai)",
    provider: "fal",
    endpoint: "fal-ai/kling-video/v2/master/image-to-video",
    maxDurationSeconds: 10,
    supportsSeed: false,
    supportsNegativePrompt: true,
    aspectRatios: ["16:9", "9:16", "1:1"],
    note: "Highest quality Kling v2 tier. 5-10s output.",
  },

  /* -- Replicate models ------------------------------------------------ */
  /*
   * Replicate and Runway use built-in Vercel serverless proxy at /api/replicate
   * and /api/runway to bypass browser CORS restrictions. Works automatically
   * when deployed to Vercel.
   */
  {
    id: "replicate-minimax-video-01",
    label: "MiniMax Video-01 (Replicate)",
    provider: "replicate",
    endpoint: "minimax/video-01",
    maxDurationSeconds: 6,
    supportsSeed: false,
    supportsNegativePrompt: false,
    aspectRatios: ["16:9", "9:16", "1:1"],
    note: "MiniMax Hailuo model via Replicate. ~6s clips.",
  },
  {
    id: "replicate-wan-i2v",
    label: "Wan 2.1 I2V (Replicate)",
    provider: "replicate",
    endpoint: "wan-video/wan-2.1-i2v",
    maxDurationSeconds: 5,
    supportsSeed: true,
    supportsNegativePrompt: true,
    aspectRatios: ["16:9", "9:16", "1:1"],
    note: "Open-source Wan model. Supports seed locking for face consistency.",
  },

  /* -- Runway models --------------------------------------------------- */
  {
    id: "runway-gen3a-turbo",
    label: "Gen-3 Alpha Turbo (Runway)",
    provider: "runway",
    endpoint: "gen3a_turbo",
    maxDurationSeconds: 10,
    supportsSeed: true,
    supportsNegativePrompt: false,
    aspectRatios: ["16:9", "9:16"],
    note: "Runway Gen-3 Alpha Turbo. 5 or 10s output. Seed supported.",
  },

  /* -- Luma models ----------------------------------------------------- */
  {
    id: "luma-ray2",
    label: "Ray-2 (Luma)",
    provider: "luma",
    endpoint: "ray-2",
    maxDurationSeconds: 9,
    supportsSeed: false,
    supportsNegativePrompt: false,
    aspectRatios: ["16:9", "9:16", "1:1"],
    note: "Luma Dream Machine Ray-2. Extend-capable. Up to 9s per call.",
  },
];

/* -------------------------------------------------------------------------
 * Defaults
 * ---------------------------------------------------------------------- */

export const DEFAULT_PROMPT = "";
export const DEFAULT_NEGATIVE_PROMPT = "blur, distort, low quality, watermark";
export const DEFAULT_DURATION_SECONDS = 5;
export const DEFAULT_ASPECT_RATIO = "16:9";
export const DEFAULT_CFG_SCALE = 0.5;
export const DEFAULT_TARGET_DURATION = 30;

/* -------------------------------------------------------------------------
 * Polling
 * ---------------------------------------------------------------------- */

/** Initial poll interval in ms. */
export const POLL_INTERVAL_BASE_MS = 4000;
/** Max poll interval after back-off in ms. */
export const POLL_INTERVAL_MAX_MS = 15000;
/** Maximum poll attempts before declaring a timeout. */
export const POLL_MAX_ATTEMPTS = 200;

/* -------------------------------------------------------------------------
 * Local storage keys
 * ---------------------------------------------------------------------- */

export const LS_KEY_API_KEYS = "kinesis_api_keys";
export const LS_KEY_GUMROAD = "kinesis_gumroad_license";
