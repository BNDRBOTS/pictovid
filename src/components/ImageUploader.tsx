/**
 * components/ImageUploader.tsx
 * ---------------------------------------------------------------------------
 * Drag-and-drop + click-to-browse image uploader with preview.
 * Accepts JPEG, PNG, WebP. Max 16 MB (provider limit).
 * Converts the selected file to a base64 data-URL for downstream use.
 * ---------------------------------------------------------------------------
 */

import { useState, useCallback, useRef } from "react";
import { fileToDataUrl } from "../api/helpers";

interface Props {
  imageUrl: string | null;
  onImageChange: (dataUrl: string) => void;
}

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUploader({ imageUrl, onImageChange }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Unsupported format. Use JPEG, PNG, or WebP.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("File exceeds 16 MB limit.");
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        onImageChange(dataUrl);
      } catch {
        setError("Failed to read the image file.");
      }
    },
    [onImageChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      /* Reset so the same file can be re-selected */
      e.target.value = "";
    },
    [processFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    },
    [processFile]
  );

  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500">
        Source Image
      </label>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onClick={() => inputRef.current?.click()}
        tabIndex={0}
        role="button"
        aria-label="Upload an image"
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          dragOver
            ? "border-sky-500 bg-sky-500/10"
            : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
        } ${imageUrl ? "h-auto min-h-[200px]" : "h-48"}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Uploaded source"
            className="max-h-80 rounded object-contain"
          />
        ) : (
          <div className="text-center">
            <svg
              className="mx-auto mb-2 h-10 w-10 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="text-sm text-neutral-400">
              Drop image here, click, or paste from clipboard
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              JPEG, PNG, or WebP -- max 16 MB
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {imageUrl && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onImageChange("");
            setError(null);
          }}
          className="mt-2 text-xs text-neutral-500 hover:text-red-400"
        >
          Remove image
        </button>
      )}
    </div>
  );
}
