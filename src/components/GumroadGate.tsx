/**
 * components/GumroadGate.tsx
 * ---------------------------------------------------------------------------
 * Gumroad license key verification gate.
 * Users must enter a valid Gumroad product license key to proceed.
 * Includes click-through bypass for development/preview.
 *
 * The GUMROAD_PRODUCT_ID is a PLACEHOLDER -- replace with the actual
 * product permalink once the Gumroad product is created.
 * ---------------------------------------------------------------------------
 */

import { useState, useCallback } from "react";
import type { GumroadLicense } from "../types";
import { LS_KEY_GUMROAD } from "../constants";
import { useLocalStorage } from "../hooks/useLocalStorage";

/* Placeholder product ID -- replace with real Gumroad product permalink */
const GUMROAD_PRODUCT_ID = "REPLACE_WITH_GUMROAD_PRODUCT_PERMALINK";

interface Props {
  children: React.ReactNode;
}

export default function GumroadGate({ children }: Props) {
  const [license, setLicense] = useLocalStorage<GumroadLicense>(
    LS_KEY_GUMROAD,
    { key: "", valid: false, checkedAt: null }
  );

  const [inputKey, setInputKey] = useState(license.key);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Verify the license key against Gumroad's public API.
   * https://app.gumroad.com/api#licenses
   */
  const verifyLicense = useCallback(async () => {
    if (!inputKey.trim()) {
      setError("Please enter a license key.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          product_id: GUMROAD_PRODUCT_ID,
          license_key: inputKey.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setLicense({
          key: inputKey.trim(),
          valid: true,
          checkedAt: Date.now(),
        });
      } else {
        setError(
          data.message || "Invalid license key. Please check and try again."
        );
      }
    } catch {
      setError(
        "Could not reach Gumroad to verify the license. Check your connection."
      );
    } finally {
      setLoading(false);
    }
  }, [inputKey, setLicense]);

  /**
   * Click-through bypass for preview / development.
   * Grants access without a valid key.
   */
  const handleBypass = useCallback(() => {
    setLicense({
      key: "__bypass__",
      valid: true,
      checkedAt: Date.now(),
    });
  }, [setLicense]);

  /* If already validated, render children */
  if (license.valid) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-8">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">
          KINESIS
        </h1>
        <p className="mb-6 text-sm text-neutral-400">
          Image-to-Video Generation Platform
        </p>

        <label
          htmlFor="gumroad-key"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500"
        >
          Gumroad License Key
        </label>
        <input
          id="gumroad-key"
          type="text"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") verifyLicense();
          }}
          placeholder="Enter your license key"
          className="mb-4 block w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        <button
          onClick={verifyLicense}
          disabled={loading}
          className="mb-3 w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify License"}
        </button>

        <button
          onClick={handleBypass}
          className="w-full rounded border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-300"
        >
          Continue Without License
        </button>

        <p className="mt-4 text-center text-xs text-neutral-600">
          A valid Gumroad license key unlocks full access. Click-through
          access is available for evaluation.
        </p>
      </div>
    </div>
  );
}
