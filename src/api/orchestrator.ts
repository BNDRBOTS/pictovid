/**
 * api/orchestrator.ts
 * ---------------------------------------------------------------------------
 * Unified orchestration layer.
 * Routes generation requests to the correct provider, manages multi-segment
 * pipelines, handles auto-stitching, and provides the primary API surface
 * consumed by React hooks.
 * ---------------------------------------------------------------------------
 */

import type {
  GenerationParams,
  VideoSegment,
  ApiKeys,
  Provider,
} from "../types";
import { submitFalJob, pollFalJob } from "./fal";
import { submitReplicateJob, pollReplicateJob } from "./replicate";
import { submitRunwayJob, pollRunwayJob } from "./runway";
import { submitLumaJob, pollLumaJob } from "./luma";
import { extractLastFrame, stitchVideos } from "./helpers";
import { ensureImageUrl } from "./imageUpload";
import { v4 as uuidv4 } from "uuid";

/* -------------------------------------------------------------------------
 * Single-segment generation
 * ---------------------------------------------------------------------- */

/**
 * Generate a single video segment from the given params.
 * Dispatches to the appropriate provider, polls to completion,
 * and returns the video URL.
 */
export async function generateSingleSegment(
  params: GenerationParams,
  apiKeys: ApiKeys,
  onProgress?: (msg: string) => void
): Promise<string> {
  const provider: Provider = params.model.provider;

  switch (provider) {
    case "fal": {
      const key = apiKeys.fal;
      if (!key) throw new Error("fal.ai API key is not configured.");
      const { statusUrl, responseUrl } = await submitFalJob(params, key);
      return await pollFalJob(statusUrl, responseUrl, key, onProgress);
    }

    case "replicate": {
      const key = apiKeys.replicate;
      if (!key) throw new Error("Replicate API key is not configured.");
      const { predictionId } = await submitReplicateJob(params, key);
      return await pollReplicateJob(predictionId, key, onProgress);
    }

    case "runway": {
      const key = apiKeys.runway;
      if (!key) throw new Error("Runway API key is not configured.");
      const { taskId } = await submitRunwayJob(params, key);
      return await pollRunwayJob(taskId, key, onProgress);
    }

    case "luma": {
      const key = apiKeys.luma;
      if (!key) throw new Error("Luma API key is not configured.");
      const { generationId } = await submitLumaJob(params, key);
      return await pollLumaJob(generationId, key, onProgress);
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/* -------------------------------------------------------------------------
 * Multi-segment pipeline
 * ---------------------------------------------------------------------- */

export interface PipelineCallbacks {
  onSegmentCreated: (segment: VideoSegment) => void;
  onSegmentUpdated: (segment: VideoSegment) => void;
  onStitchStart: () => void;
  onStitchComplete: (url: string) => void;
  onError: (error: string) => void;
  onProgress: (segmentId: string, msg: string) => void;
}

/**
 * Calculate the number of segments required to meet a target duration,
 * given a per-segment max duration.
 */
export function computeSegmentCount(
  targetDuration: number,
  perSegmentMax: number
): number {
  if (targetDuration <= 0 || perSegmentMax <= 0) return 1;
  return Math.ceil(targetDuration / perSegmentMax);
}

/**
 * Determine the duration for each segment. The last segment may be shorter
 * to avoid exceeding the target.
 */
export function computeSegmentDurations(
  targetDuration: number,
  perSegmentMax: number
): number[] {
  const count = computeSegmentCount(targetDuration, perSegmentMax);
  const durations: number[] = [];
  let remaining = targetDuration;

  for (let i = 0; i < count; i++) {
    const dur = Math.min(remaining, perSegmentMax);
    durations.push(dur);
    remaining -= dur;
  }

  return durations;
}

/**
 * Execute a full multi-segment pipeline:
 * 1. Compute segment count from target duration.
 * 2. For each segment, generate video.
 * 3. Extract last frame of each completed segment as the start image for the next.
 * 4. After all segments complete, auto-stitch into a single video.
 *
 * This function is designed to be cancellable via an AbortSignal.
 */
export async function runPipeline(
  baseParams: GenerationParams,
  targetDuration: number,
  apiKeys: ApiKeys,
  callbacks: PipelineCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const maxDur = baseParams.model.maxDurationSeconds;
  const durations = computeSegmentDurations(targetDuration, maxDur);
  const segments: VideoSegment[] = [];
  const completedVideoUrls: string[] = [];

  /* Create all segment placeholders */
  for (let i = 0; i < durations.length; i++) {
    const seg: VideoSegment = {
      id: uuidv4(),
      index: i,
      status: "queued",
      remoteId: null,
      videoUrl: null,
      lastFrameUrl: null,
      error: null,
      pollCount: 0,
      params: {
        ...baseParams,
        durationSeconds: durations[i],
        /* The first segment uses the user's original image.
         * Subsequent segments will have imageUrl replaced with the
         * last frame of the previous segment (set during iteration). */
        imageUrl: i === 0 ? baseParams.imageUrl : "",
      },
      createdAt: Date.now(),
    };
    segments.push(seg);
    callbacks.onSegmentCreated(seg);
  }

  /* Generate segments sequentially (chained by last-frame extraction) */
  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) {
      segments[i].status = "cancelled";
      callbacks.onSegmentUpdated(segments[i]);
      break;
    }

    const seg = segments[i];
    seg.status = "submitting";
    callbacks.onSegmentUpdated(seg);

    try {
      /* If not the first segment, use the last frame of the previous */
      if (i > 0) {
        const prevSeg = segments[i - 1];
        if (!prevSeg.lastFrameUrl) {
          throw new Error(
            `Cannot chain segment ${i}: previous segment has no last frame.`
          );
        }
        seg.params = { ...seg.params, imageUrl: prevSeg.lastFrameUrl };

        /* Preserve seed across segments if user locked it (face consistency) */
        if (baseParams.seed !== null && baseParams.model.supportsSeed) {
          seg.params.seed = baseParams.seed;
        }
      }

      seg.status = "processing";
      callbacks.onSegmentUpdated(seg);

      /* Ensure image is hosted via HTTPS URL before sending to provider */
      const hostedImageUrl = await ensureImageUrl(
        seg.params.imageUrl,
        seg.params.model.provider,
        apiKeys
      );
      const paramsWithHostedImage: GenerationParams = {
        ...seg.params,
        imageUrl: hostedImageUrl,
      };

      const videoUrl = await generateSingleSegment(
        paramsWithHostedImage,
        apiKeys,
        (msg) => callbacks.onProgress(seg.id, msg)
      );

      seg.videoUrl = videoUrl;
      completedVideoUrls.push(videoUrl);

      /* Extract last frame for chaining to the next segment */
      try {
        seg.lastFrameUrl = await extractLastFrame(videoUrl);
      } catch (frameErr) {
        /*
         * Non-fatal: if frame extraction fails, subsequent segments
         * fall back to the original image. This is a graceful degradation
         * rather than a pipeline-killing failure.
         */
        console.warn(
          `Last-frame extraction failed for segment ${i}; falling back to original image.`,
          frameErr
        );
        seg.lastFrameUrl = baseParams.imageUrl;
      }

      seg.status = "succeeded";
      callbacks.onSegmentUpdated(seg);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown generation error";
      seg.status = "failed";
      seg.error = message;
      callbacks.onSegmentUpdated(seg);
      callbacks.onError(`Segment ${i + 1} failed: ${message}`);
      /* Do not abort the entire pipeline -- skip and continue if possible */
      /* But chain is broken, so remaining segments cannot proceed */
      for (let j = i + 1; j < segments.length; j++) {
        segments[j].status = "cancelled";
        segments[j].error = "Cancelled due to prior segment failure.";
        callbacks.onSegmentUpdated(segments[j]);
      }
      break;
    }
  }

  /* Stitch completed segments */
  if (completedVideoUrls.length === 0) {
    callbacks.onError("No segments completed successfully. Nothing to stitch.");
    return;
  }

  if (completedVideoUrls.length === 1) {
    /* Single segment -- no stitching needed */
    callbacks.onStitchComplete(completedVideoUrls[0]);
    return;
  }

  callbacks.onStitchStart();

  try {
    const stitchedUrl = await stitchVideos(completedVideoUrls);
    callbacks.onStitchComplete(stitchedUrl);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown stitching error";
    callbacks.onError(`Stitching failed: ${message}`);
  }
}
