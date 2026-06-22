/**
 * types.ts
 * ---------------------------------------------------------------------------
 * Central type definitions for the KINESIS image-to-video pipeline.
 * Every module imports from here to guarantee a single source of truth.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------
 * Provider / Model taxonomy
 * ---------------------------------------------------------------------- */

/** Supported API providers. */
export type Provider =
  | "fal"
  | "replicate"
  | "runway"
  | "luma";

/** Canonical model identifiers mapped per provider. */
export interface ModelDescriptor {
  id: string;
  label: string;
  provider: Provider;
  /** The endpoint-specific model string sent to the API. */
  endpoint: string;
  /** Maximum single-generation duration in seconds. */
  maxDurationSeconds: number;
  /** Whether the model supports seed locking for deterministic output. */
  supportsSeed: boolean;
  /** Whether the model supports negative prompts. */
  supportsNegativePrompt: boolean;
  /** Supported aspect ratios. */
  aspectRatios: string[];
  /** Brief human-readable note. */
  note: string;
}

/* -------------------------------------------------------------------------
 * Generation parameters
 * ---------------------------------------------------------------------- */

export interface GenerationParams {
  /** Selected model descriptor. */
  model: ModelDescriptor;
  /** Prompt text driving the animation. */
  prompt: string;
  /** Optional negative prompt. */
  negativePrompt: string;
  /** Duration per clip in seconds. */
  durationSeconds: number;
  /** Aspect ratio string e.g. "16:9". */
  aspectRatio: string;
  /** Optional deterministic seed. Null means random. */
  seed: number | null;
  /** CFG / guidance scale where supported. */
  cfgScale: number;
  /** Base64 data-url or remote URL of the source image. */
  imageUrl: string;
}

/* -------------------------------------------------------------------------
 * Job / Segment tracking
 * ---------------------------------------------------------------------- */

export type SegmentStatus =
  | "queued"
  | "submitting"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface VideoSegment {
  /** Unique local identifier. */
  id: string;
  /** Zero-based index in the stitch sequence. */
  index: number;
  /** Current lifecycle status. */
  status: SegmentStatus;
  /** Remote prediction / task ID from the API. */
  remoteId: string | null;
  /** URL of the finished video clip. */
  videoUrl: string | null;
  /** URL of the last frame extracted for chaining. */
  lastFrameUrl: string | null;
  /** Human-readable error message when status is "failed". */
  error: string | null;
  /** Polling attempt counter for back-off. */
  pollCount: number;
  /** The generation params used for this segment. */
  params: GenerationParams;
  /** Timestamp of creation. */
  createdAt: number;
}

export type PipelineStatus =
  | "idle"
  | "generating"
  | "stitching"
  | "complete"
  | "error";

export interface PipelineState {
  status: PipelineStatus;
  segments: VideoSegment[];
  /** Stitched output URL, available once stitching completes. */
  stitchedUrl: string | null;
  /** Total desired duration (for auto-segment calculation). */
  targetDurationSeconds: number;
  /** Global error message if any. */
  error: string | null;
}

/* -------------------------------------------------------------------------
 * API Key configuration
 * ---------------------------------------------------------------------- */

export interface ApiKeys {
  fal: string;
  replicate: string;
  runway: string;
  luma: string;
}

/* -------------------------------------------------------------------------
 * Gumroad access gate
 * ---------------------------------------------------------------------- */

export interface GumroadLicense {
  key: string;
  valid: boolean;
  checkedAt: number | null;
}
