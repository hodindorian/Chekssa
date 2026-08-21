import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTwitterVideo } from "./twitterVideo.js";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveTwitterVideo", () => {
  it("extracts the highest-bitrate mp4 variant from a tweet with a video", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        mediaDetails: [
          {
            type: "video",
            video_info: {
              duration_millis: 5000,
              variants: [
                { content_type: "video/mp4", url: "https://cdn/low.mp4", bitrate: 100 },
                { content_type: "video/mp4", url: "https://cdn/high.mp4", bitrate: 900 },
              ],
            },
            original_info: { width: 1280, height: 720 },
          },
        ],
      })
    );

    const result = await resolveTwitterVideo("123");
    expect(result).toEqual({ videoUrl: "https://cdn/high.mp4", aspectRatio: 1280 / 720, durationMs: 5000 });
  });

  it("falls back to a 16:9 aspect ratio when dimensions are missing", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        mediaDetails: [
          {
            type: "animated_gif",
            video_info: { variants: [{ content_type: "video/mp4", url: "https://cdn/a.mp4", bitrate: 500 }] },
          },
        ],
      })
    );
    const result = await resolveTwitterVideo("123");
    expect(result.aspectRatio).toBe(16 / 9);
  });

  it("looks inside a quoted tweet when the tweet itself has no media", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        mediaDetails: [],
        quoted_tweet: {
          mediaDetails: [
            {
              type: "video",
              video_info: { variants: [{ content_type: "video/mp4", url: "https://cdn/quoted.mp4", bitrate: 1 }] },
            },
          ],
        },
      })
    );
    const result = await resolveTwitterVideo("123");
    expect(result.videoUrl).toBe("https://cdn/quoted.mp4");
  });

  it("throws a clear error when the tweet has no video", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ mediaDetails: [] }));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("Aucune vidéo trouvée");
  });

  it("throws when no mp4 variant is available", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ mediaDetails: [{ type: "video", video_info: { variants: [] } }] })
    );
    await expect(resolveTwitterVideo("123")).rejects.toThrow("Format vidéo non pris en charge");
  });

  it("throws a not-found error on a 404", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("introuvable");
  });

  it("throws a generic error on other HTTP failures", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("Erreur X/Twitter (500)");
  });

  it("treats a tweet with no mediaDetails key at all as having no media", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ quoted_tweet: {} }));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("Aucune vidéo trouvée");
  });

  it("treats a video with no variants list at all as unsupported", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ mediaDetails: [{ type: "video", video_info: {} }] }));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("Format vidéo non pris en charge");
  });

  it("treats a missing bitrate as 0 when picking the best variant", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        mediaDetails: [
          {
            type: "video",
            video_info: {
              variants: [
                { content_type: "video/mp4", url: "https://cdn/no-bitrate.mp4" },
                { content_type: "video/mp4", url: "https://cdn/with-bitrate.mp4", bitrate: 1 },
              ],
            },
          },
        ],
      })
    );
    const result = await resolveTwitterVideo("123");
    expect(result.videoUrl).toBe("https://cdn/with-bitrate.mp4");
  });

  it("treats a missing bitrate as 0 even when it's the later variant", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        mediaDetails: [
          {
            type: "video",
            video_info: {
              variants: [
                { content_type: "video/mp4", url: "https://cdn/with-bitrate.mp4", bitrate: 5 },
                { content_type: "video/mp4", url: "https://cdn/no-bitrate.mp4" },
              ],
            },
          },
        ],
      })
    );
    const result = await resolveTwitterVideo("123");
    expect(result.videoUrl).toBe("https://cdn/with-bitrate.mp4");
  });
});
