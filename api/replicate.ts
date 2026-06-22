/**
 * api/replicate.ts
 * ---------------------------------------------------------------------------
 * Vercel serverless function that proxies requests to Replicate API.
 * Bypasses browser CORS restrictions by making server-side requests.
 *
 * Deployment: Deploy to Vercel. This file is auto-detected as a serverless
 * function at /api/replicate
 *
 * Usage from client:
 *   POST /api/replicate { targetPath: "/v1/models/minimax/video-01/predictions", body: {...} }
 *   GET  /api/replicate?targetPath=/v1/predictions/abc123
 *
 * The client sends the API key in the Authorization header as normal.
 * This proxy forwards it to Replicate.
 * ---------------------------------------------------------------------------
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const REPLICATE_API_BASE = "https://api.replicate.com";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  /* Enable CORS for browser requests */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  /* Handle preflight */
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    /* Extract target path from query or body */
    const targetPath =
      (req.query.targetPath as string) ||
      (req.body?.targetPath as string);

    if (!targetPath) {
      res.status(400).json({
        error: "Missing targetPath parameter",
        usage: {
          POST: "Include targetPath in body along with request payload",
          GET: "Include targetPath as query parameter",
        },
      });
      return;
    }

    /* Forward Authorization header */
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }

    /* Build the proxied request */
    const targetUrl = `${REPLICATE_API_BASE}${targetPath}`;
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    };

    /* Include body for POST/PUT/PATCH */
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const { targetPath: _removed, ...bodyWithoutPath } = req.body || {};
      if (Object.keys(bodyWithoutPath).length > 0) {
        fetchOptions.body = JSON.stringify(bodyWithoutPath);
      }
    }

    /* Execute proxied request */
    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    /* Forward response */
    res.status(response.status);

    if (contentType.includes("application/json")) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown proxy error";
    res.status(500).json({ error: "Proxy error", details: message });
  }
}
