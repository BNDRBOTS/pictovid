/**
 * api/replicate.ts
 * ---------------------------------------------------------------------------
 * Replicate provider implementation.
 * Uses the official v1 REST API: POST /v1/models/{owner}/{model}/predictions
 * then polls GET /v1/predictions/{id}.
 * Docs: https://replicate.com/docs
 * ---------------------------------------------------------------------------
 */

import type { GenerationParams } from "../types";
import { apiFetch, sleep } from "./helpers";
import {
  POLL_INTERVAL_BASE_MS,
  POLL_INTERVAL_MAX_MS,
  POLL_MAX_ATTEMPTS,
} from "../constants";

/* -------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------- */

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  logs?: string;
  urls?: {
    get?: string;
    cancel?: string;
  };
}

/* -------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------- */

/**
 * Use local Vercel proxy to bypass CORS restrictions.
 * The proxy forwards requests to https://api.replicate.com
 * Falls back to direct API if proxy unavailable (for non-Vercel deployments).
 */
const REPLICATE_PROXY = "/api/replicate";
const REPLICATE_API_BASE = "https://api.replicate.com/v1";

/* -------------------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------------------- */

/**
 * Create a Replicate prediction for image-to-video.
 * Returns the prediction ID for subsequent polling.
 */
export async function submitReplicateJob(
  params: GenerationParams,
  apiKey: string
): Promise<{ predictionId: string }> {
  const modelSlug = params.model.endpoint; // e.g. "minimax/video-01"
  const targetPath = `/v1/models/${modelSlug}/predictions`;

  /* Build input -- field names are model-specific */
  const input: Record<string, unknown> = {
    prompt: params.prompt,
  };

  /* minimax/video-01 uses first_frame_image; wan uses image */
  if (modelSlug.includes("minimax")) {
    input.first_frame_image = params.imageUrl;
  } else if (modelSlug.includes("wan")) {
    input.image = params.imageUrl;
    if (params.seed !== null) {
      input.seed = params.seed;
    }
    if (params.negativePrompt && params.model.supportsNegativePrompt) {
      input.negative_prompt = params.negativePrompt;
    }
  } else {
    /* Generic fallback */
    input.start_image = params.imageUrl;
  }

  if (params.durationSeconds) {
    input.duration = params.durationSeconds;
  }

  if (params.aspectRatio) {
    input.aspect_ratio = params.aspectRatio;
  }

  /*
   * Try proxy first (works on Vercel deployment).
   * Fall back to direct API call (will fail with CORS error in browser,
   * but works if user has their own proxy setup).
   */
  let res: Response;
  let usedProxy = false;

  try {
    /* Attempt via local Vercel proxy */
    res = await apiFetch(REPLICATE_PROXY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetPath, input }),
    });
    usedProxy = true;
  } catch {
    /* Proxy unavailable, try direct (will likely CORS fail in browser) */
    try {
      res = await apiFetch(`${REPLICATE_API_BASE}${targetPath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "respond-async",
        },
        body: JSON.stringify({ input }),
      });
    } catch (err: unknown) {
      if (
        err instanceof TypeError ||
        (err instanceof Error && err.message.includes("fetch"))
      ) {
        throw new Error(
          "Replicate API request failed. Deploy to Vercel to enable the proxy, " +
            "or use fal.ai/Luma models which work directly in browser."
        );
      }
      throw err;
    }
  }

  void usedProxy;

  let json: ReplicatePrediction;
  try {
    json = await res.json();
  } catch {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Replicate returned invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (!json.id) {
    throw new Error(
      `Replicate did not return a prediction ID: ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  return { predictionId: json.id };
}

/**
 * Poll a Replicate prediction until terminal state.
 * Returns the video URL on success.
 */
export async function pollReplicateJob(
  predictionId: string,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const targetPath = `/v1/predictions/${predictionId}`;
  let interval = POLL_INTERVAL_BASE_MS;

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(interval);

    let res: Response;

    /* Try proxy first, fall back to direct */
    try {
      res = await apiFetch(`${REPLICATE_PROXY}?targetPath=${encodeURIComponent(targetPath)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
    } catch {
      try {
        res = await apiFetch(`${REPLICATE_API_BASE}${targetPath}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
      } catch (err: unknown) {
        if (
          err instanceof TypeError ||
          (err instanceof Error && err.message.includes("fetch"))
        ) {
          throw new Error(
            "Replicate API request failed. Deploy to Vercel to enable the proxy."
          );
        }
        throw err;
      }
    }

    let prediction: ReplicatePrediction;
    try {
      prediction = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Replicate returned invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
      );
    }

    if (prediction.logs && onProgress) {
      onProgress(prediction.logs.slice(-200));
    }

    if (prediction.status === "succeeded") {
      /* Output may be a string URL or an array of URLs */
      const output = prediction.output;
      if (typeof output === "string") return output;
      if (Array.isArray(output) && output.length > 0) return output[0];
      throw new Error(
        `Replicate succeeded but no output URL: ${JSON.stringify(prediction).slice(0, 300)}`
      );
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(
        `Replicate prediction ${prediction.status}: ${prediction.error || "unknown error"}`
      );
    }

    interval = Math.min(interval * 1.3, POLL_INTERVAL_MAX_MS);
  }

  throw new Error(
    `Replicate prediction did not complete within ${POLL_MAX_ATTEMPTS} poll attempts.`
  );
}
