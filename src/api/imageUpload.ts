/**
 * api/imageUpload.ts
 * ---------------------------------------------------------------------------
 * Provider-specific image upload utilities.
 *
 * Problem: Most video generation APIs require images to be accessible via
 * HTTPS URLs, not base64 data-URLs. Since this is a client-side app without
 * a backend, we need to upload images directly to each provider's storage
 * or a compatible intermediary.
 *
 * Strategies per provider:
 * - fal.ai: Upload via fal's storage API (PUT with binary body).
 * - Replicate: Upload via POST /v1/files (returns a serving URL).
 * - Runway: Accepts base64 data-URLs directly in promptImage field.
 * - Luma: Requires hosted URL; upload to Replicate's file API as fallback.
 *
 * If all uploads fail, the original data-URL is passed through. Some APIs
 * may reject it, but the error handling at the generation level will catch
 * and report that clearly.
 * ---------------------------------------------------------------------------
 */

import type { Provider } from "../types";
import { apiFetch, dataUrlToBase64 } from "./helpers";

/**
 * Convert a base64 data-URL into a Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const base64 = dataUrlToBase64(dataUrl);
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const mimeMatch = dataUrl.match(/^data:(image\/\w+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  return new Blob([bytes], { type: mimeType });
}

/**
 * Upload an image to fal.ai storage.
 * Returns the HTTPS URL of the uploaded file.
 *
 * Uses the multipart/form-data endpoint at:
 * POST https://api.fal.ai/v1/serverless/files/file/local/{target_path}
 * Field name must be "file_upload".
 */
async function uploadToFal(
  dataUrl: string,
  apiKey: string
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type.split("/")[1] || "png";
  const filename = `input_${Date.now()}.${ext}`;
  const targetPath = `uploads/${filename}`;

  const formData = new FormData();
  formData.append("file_upload", blob, filename);

  const res = await apiFetch(
    `https://api.fal.ai/v1/serverless/files/file/local/${encodeURIComponent(targetPath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
      body: formData,
    },
    { maxRetries: 1, timeoutMs: 60_000 }
  );

  let json: { url?: string; file_url?: string };
  try {
    json = await res.json();
  } catch {
    /* If JSON parse fails, try text */
    const text = await res.text().catch(() => "");
    throw new Error(`fal upload failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  /* fal returns the URL in either "url" or "file_url" field */
  const uploadedUrl = json?.url || json?.file_url;
  if (uploadedUrl) return uploadedUrl;

  /* Fallback: construct the CDN URL from the target path */
  return `https://v3.fal.media/files/${targetPath}`;
}

/**
 * Upload an image to Replicate's file storage.
 * Returns the HTTPS URL of the uploaded file.
 * Docs: POST /v1/files with multipart/form-data
 */
async function uploadToReplicate(
  dataUrl: string,
  apiKey: string
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);

  const formData = new FormData();
  formData.append("content", blob, "input.png");

  const res = await apiFetch(
    "https://api.replicate.com/v1/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    },
    { maxRetries: 1, timeoutMs: 60_000 }
  );

  const json = await res.json();
  if (json?.urls?.get) return json.urls.get;
  throw new Error("Replicate file upload did not return a URL.");
}

/**
 * Ensure an image is available as an HTTPS URL for the given provider.
 * If the input is already an HTTPS URL, returns it as-is.
 * If it is a data-URL, uploads to the provider's storage (or fallback).
 */
export async function ensureImageUrl(
  imageUrl: string,
  provider: Provider,
  apiKeys: { fal: string; replicate: string; runway: string; luma: string }
): Promise<string> {
  /* Already hosted -- return as-is */
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
    return imageUrl;
  }

  /* Must be a data-URL -- upload to provider storage */
  switch (provider) {
    case "fal": {
      if (apiKeys.fal) {
        try {
          return await uploadToFal(imageUrl, apiKeys.fal);
        } catch (e) {
          console.warn("fal image upload failed, trying Replicate fallback.", e);
        }
      }
      /* Fallback to Replicate if available */
      if (apiKeys.replicate) {
        try {
          return await uploadToReplicate(imageUrl, apiKeys.replicate);
        } catch (e) {
          console.warn("Replicate fallback upload also failed.", e);
        }
      }
      /* Last resort: return the data URL and let the API error if it cannot handle it */
      return imageUrl;
    }

    case "replicate": {
      if (apiKeys.replicate) {
        try {
          return await uploadToReplicate(imageUrl, apiKeys.replicate);
        } catch (e) {
          console.warn("Replicate image upload failed.", e);
        }
      }
      return imageUrl;
    }

    case "runway": {
      /*
       * Runway's API accepts base64 data-URLs in the promptImage field
       * (they handle upload server-side). Return the data-URL directly.
       */
      return imageUrl;
    }

    case "luma": {
      /*
       * Luma requires a hosted URL. Try fal upload first (since user
       * likely has fal key if using this app), then give up with
       * a clear error.
       */
      if (apiKeys.fal) {
        try {
          return await uploadToFal(imageUrl, apiKeys.fal);
        } catch (e) {
          console.warn("fal upload for Luma failed.", e);
        }
      }
      /*
       * No upload succeeded. Return the data URL anyway -- Luma will
       * reject it, but the error will be clear to the user.
       */
      console.warn(
        "Luma requires a hosted image URL. Upload failed. Generation will likely fail."
      );
      return imageUrl;
    }

    default:
      return imageUrl;
  }
}
