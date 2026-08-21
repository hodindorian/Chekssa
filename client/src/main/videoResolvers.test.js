import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkYoutubeEmbeddable, resolveTwitterVideo } from "./videoResolvers.js";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function textResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
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
                { content_type: "application/x-mpegURL", url: "https://cdn/playlist.m3u8" },
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

  it("throws a clear error when the tweet has no video", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ mediaDetails: [] }));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("Aucune vidéo trouvée");
  });

  it("throws a not-found error on a 404", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("introuvable");
  });

  it("throws a generic error on other HTTP failures", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(resolveTwitterVideo("123")).rejects.toThrow("Erreur X/Twitter (500)");
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

describe("checkYoutubeEmbeddable", () => {
  it("throws when the uploader disabled embedding (oEmbed 401/403)", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(checkYoutubeEmbeddable("abc")).rejects.toThrow("intégration");
  });

  it("throws a not-found error when oEmbed 404s", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 404));
    await expect(checkYoutubeEmbeddable("abc")).rejects.toThrow("introuvable");
  });

  it("resolves ok when oEmbed passes and the watch page reports status OK", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ title: "ok" }));
    fetch.mockResolvedValueOnce(textResponse('"playabilityStatus":{"status":"OK"}'));
    await expect(checkYoutubeEmbeddable("abc")).resolves.toEqual({ ok: true });
  });

  it("reports a license/copyright block with a dedicated message", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ title: "ok" }));
    fetch.mockResolvedValueOnce(
      textResponse(
        '"playabilityStatus":{"status":"UNPLAYABLE","reason":"This video contains content from SME, who has blocked it on copyright grounds"}'
      )
    );
    await expect(checkYoutubeEmbeddable("abc")).rejects.toThrow("sous licence");
  });

  it("surfaces the real reason for a non-license playability block", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ title: "ok" }));
    fetch.mockResolvedValueOnce(textResponse('"playabilityStatus":{"status":"ERROR","reason":"Video removed"}'));
    await expect(checkYoutubeEmbeddable("abc")).rejects.toThrow("Video removed");
  });

  it("doesn't block sending if the watch-page check itself fails", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ title: "ok" }));
    fetch.mockRejectedValueOnce(new Error("network down"));
    await expect(checkYoutubeEmbeddable("abc")).resolves.toEqual({ ok: true });
  });

  it("doesn't block sending if the watch page itself responds with an error status", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ title: "ok" }));
    fetch.mockResolvedValueOnce(textResponse("", 503));
    await expect(checkYoutubeEmbeddable("abc")).resolves.toEqual({ ok: true });
  });

  it("doesn't block sending if the watch page has no recognizable playability status", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ title: "ok" }));
    fetch.mockResolvedValueOnce(textResponse("<html>nothing useful here</html>"));
    await expect(checkYoutubeEmbeddable("abc")).resolves.toEqual({ ok: true });
  });

  it("throws a generic error for other oEmbed failures", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(checkYoutubeEmbeddable("abc")).rejects.toThrow("Impossible de vérifier");
  });

  it("falls back to a generic message when a non-OK status has no extractable reason", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ title: "ok" }));
    fetch.mockResolvedValueOnce(textResponse('"playabilityStatus":{"status":"ERROR"}'));
    await expect(checkYoutubeEmbeddable("abc")).rejects.toThrow("n'est pas disponible en intégration");
  });
});
