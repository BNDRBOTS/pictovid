/**
 * components/VideoPlayer.tsx
 * ---------------------------------------------------------------------------
 * Displays the final stitched video (or individual segment videos).
 * Provides download functionality.
 * ---------------------------------------------------------------------------
 */

import { useCallback } from "react";
import type { PipelineState } from "../types";

interface Props {
  state: PipelineState;
}

export default function VideoPlayer({ state }: Props) {
  const videoUrl = state.stitchedUrl;

  const completedSegments = state.segments.filter(
    (s) => s.status === "succeeded" && s.videoUrl
  );

  const handleDownload = useCallback(
    async (url: string, filename: string) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } catch {
        /* Fallback: open in new tab */
        window.open(url, "_blank");
      }
    },
    []
  );

  if (!videoUrl && completedSegments.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Output
      </p>

      {/* Main stitched video */}
      {videoUrl && (
        <div>
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full rounded border border-neutral-700"
          >
            Your browser does not support the video element.
          </video>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                handleDownload(videoUrl, `kinesis-output-${Date.now()}.mp4`)
              }
              className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              Download Final Video
            </button>
          </div>
        </div>
      )}

      {/* Individual segment clips */}
      {completedSegments.length > 1 && (
        <div>
          <p className="mb-2 text-xs text-neutral-500">
            Individual segments ({completedSegments.length})
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {completedSegments.map((seg) => (
              <div key={seg.id}>
                <video
                  src={seg.videoUrl!}
                  controls
                  playsInline
                  className="w-full rounded border border-neutral-700"
                />
                <button
                  onClick={() =>
                    handleDownload(
                      seg.videoUrl!,
                      `kinesis-segment-${seg.index + 1}.mp4`
                    )
                  }
                  className="mt-1 text-xs text-neutral-500 hover:text-sky-400"
                >
                  Download Segment #{seg.index + 1}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
