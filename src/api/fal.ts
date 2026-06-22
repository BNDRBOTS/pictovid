/**
 * api/fal.ts
 * ---------------------------------------------------------------------------
 * fal.ai provider implementation.
 * Uses the REST queue API (submit -> poll -> result) pattern.
 * Docs: https://fal.ai/docs and model-specific API references.
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
 * Types for fal queue responses
 * ---------------------------------------------------------------------- */

interface FalQueueResponse {
  request_id: string;
  status: string;
  response_url?: string;
  status_url?: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  response_url?: string;
  logs?: Array<{ message: string }>;
}

interface FalResultResponse {
  video?: {
    url: string;
    content_type?: string;
    file_size?: number;
  };
}

/* -------------------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------------------- */

/**
 * Submit an image-to-video job to fal.ai and return the request_id
 * plus status/response URLs for polling.
 */
export async function submitFalJob(
  params: GenerationParams,
  apiKey: string
): Promise<{ requestId: string; statusUrl: string; responseUrl: string }> {
  const endpointId = params.model.endpoint;
  const submitUrl = `https://queue.fal.run/${endpointId}`;

  /* Build input payload -- field names vary slightly across kling model generations */
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: String(params.durationSeconds),
  };

  /* Determine image field name based on endpoint pattern */
  if (endpointId.includes("/v3/") || endpointId.includes("/v2/")) {
    input.start_image_url = params.imageUrl;
  } else {
    /* O3 and v1 endpoints use image_url */
    input.image_url = params.imageUrl;
  }

  if (params.negativePrompt && params.model.supportsNegativePrompt) {
    input.negative_prompt = params.negativePrompt;
  }

  if (params.cfgScale !== undefined) {
    input.cfg_scale = params.cfgScale;
  }

  if (params.aspectRatio) {
    input.aspect_ratio = params.aspectRatio;
  }

  const res = await apiFetch(submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  let json: FalQueueResponse;
  try {
    json = await res.json();
  } catch {
    const text = await res.text().catch(() => "");
    throw new Error(
      `fal.ai returned invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (!json.request_id) {
    throw new Error(
      `fal submit did not return a request_id: ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  const statusUrl =
    json.status_url ||
    `https://queue.fal.run/${endpointId}/requests/${json.request_id}/status`;
  const responseUrl =
    json.response_url ||
    `https://queue.fal.run/${endpointId}/requests/${json.request_id}`;

  return {
    requestId: json.request_id,
    statusUrl,
    responseUrl,
  };
}

/**
 * Poll a fal.ai job until completion or failure.
 * Returns the video URL on success.
 *
 * @param onProgress - optional callback receiving log messages
 */
export async function pollFalJob(
  statusUrl: string,
  responseUrl: string,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  let interval = POLL_INTERVAL_BASE_MS;

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(interval);

    const res = await apiFetch(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    });

    let status: FalStatusResponse;
    try {
      status = await res.json();
    } catch {
      const text = await res.text().catch(() => "");
      throw new Error(
        `fal.ai returned invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
      );
    }

    if (status.logs && onProgress) {
      for (const log of status.logs) {
        onProgress(log.message);
      }
    }

    if (status.status === "COMPLETED") {
      /* Fetch the actual result */
      const resultRes = await apiFetch(responseUrl, {
        method: "GET",
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      });

      let result: FalResultResponse;
      try {
        result = await resultRes.json();
      } catch {
        const text = await resultRes.text().catch(() => "");
        throw new Error(
          `fal.ai result returned invalid JSON (HTTP ${resultRes.status}): ${text.slice(0, 200)}`
        );
      }

      if (!result.video?.url) {
        throw new Error(
          `fal job completed but no video URL in response: ${JSON.stringify(result).slice(0, 300)}`
        );
      }

      return result.video.url;
    }

    if (status.status === "FAILED") {
      throw new Error("fal.ai generation failed. Check prompt/image and retry.");
    }

    /* Adaptive back-off */
    interval = Math.min(interval * 1.3, POLL_INTERVAL_MAX_MS);
  }

  throw new Error(
    `fal.ai job did not complete within ${POLL_MAX_ATTEMPTS} poll attempts.`
  );
}
