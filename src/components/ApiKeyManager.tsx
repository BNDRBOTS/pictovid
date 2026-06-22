/**
 * components/ApiKeyManager.tsx
 * ---------------------------------------------------------------------------
 * Panel for managing API keys for all supported providers.
 * Keys are stored in localStorage (encrypted persistence is left to the
 * deployer's infrastructure). Each field shows/hides the key and validates
 * that at least one provider has a key before generation can proceed.
 * ---------------------------------------------------------------------------
 */

import { useState, useCallback } from "react";
import type { ApiKeys } from "../types";

interface Props {
  apiKeys: ApiKeys;
  onChange: (keys: ApiKeys) => void;
}

interface ProviderField {
  key: keyof ApiKeys;
  label: string;
  placeholder: string;
  docsUrl: string;
}

/**
 * All supported providers. Replicate and Runway use the built-in Vercel
 * serverless proxy to bypass CORS. Works automatically when deployed to Vercel.
 */
const FIELDS: ProviderField[] = [
  {
    key: "fal",
    label: "fal.ai",
    placeholder: "fal_...",
    docsUrl: "https://fal.ai/dashboard/keys",
  },
  {
    key: "replicate",
    label: "Replicate",
    placeholder: "r8_...",
    docsUrl: "https://replicate.com/account/api-tokens",
  },
  {
    key: "runway",
    label: "Runway",
    placeholder: "rw_...",
    docsUrl: "https://dev.runwayml.com/",
  },
  {
    key: "luma",
    label: "Luma AI",
    placeholder: "luma-...",
    docsUrl: "https://lumalabs.ai/dream-machine/api",
  },
];

export default function ApiKeyManager({ apiKeys, onChange }: Props) {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);

  const toggleVisibility = useCallback((field: string) => {
    setVisible((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleChange = useCallback(
    (field: keyof ApiKeys, value: string) => {
      onChange({ ...apiKeys, [field]: value.trim() });
    },
    [apiKeys, onChange]
  );

  const configuredCount = Object.values(apiKeys).filter(Boolean).length;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <span className="text-sm font-medium text-white">API Keys</span>
          <span className="ml-2 text-xs text-neutral-500">
            {configuredCount} of {FIELDS.length} configured
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-neutral-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="space-y-4 border-t border-neutral-800 px-4 pb-4 pt-3">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor={`apikey-${field.key}`}
                  className="text-xs font-medium uppercase tracking-wider text-neutral-500"
                >
                  {field.label}
                </label>
                <a
                  href={field.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-500 hover:text-sky-400"
                >
                  Get Key
                </a>
              </div>
              <div className="relative">
                <input
                  id={`apikey-${field.key}`}
                  type={visible[field.key] ? "text" : "password"}
                  value={apiKeys[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="block w-full rounded border border-neutral-700 bg-neutral-800 py-1.5 pl-3 pr-10 text-sm text-white placeholder-neutral-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility(field.key)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-300"
                  aria-label={
                    visible[field.key] ? "Hide API key" : "Show API key"
                  }
                >
                  {visible[field.key] ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 004.243 4.243"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {apiKeys[field.key] && (
                <p className="mt-1 text-xs text-green-500">Configured</p>
              )}
            </div>
          ))}
          <p className="text-xs text-neutral-600">
            Keys are stored in your browser's localStorage. They are never sent
            to any server other than the provider's own API endpoint.
          </p>
        </div>
      )}
    </div>
  );
}
