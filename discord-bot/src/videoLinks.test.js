import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./videoLinks.js";

describe("parseVideoUrl", () => {
  it("returns null for an unrecognized/invalid input", () => {
    expect(parseVideoUrl("")).toBeNull();
    expect(parseVideoUrl("not a url")).toBeNull();
    expect(parseVideoUrl("https://example.com/video")).toBeNull();
  });

  it("parses a standard youtube.com watch URL", () => {
    const result = parseVideoUrl("https://www.youtube.com/watch?v=abc123XYZ_-");
    expect(result).toEqual({
      platform: "youtube",
      videoId: "abc123XYZ_-",
      startFromUrl: null,
      aspectRatio: 16 / 9,
    });
  });

  it("parses a youtu.be short link", () => {
    const result = parseVideoUrl("https://youtu.be/abc123");
    expect(result.platform).toBe("youtube");
    expect(result.videoId).toBe("abc123");
  });

  it("parses a youtube shorts URL as portrait", () => {
    const result = parseVideoUrl("https://www.youtube.com/shorts/abc123");
    expect(result.platform).toBe("youtube");
    expect(result.videoId).toBe("abc123");
    expect(result.aspectRatio).toBe(9 / 16);
  });

  it("reads a plain-seconds start timestamp from ?t=", () => {
    const result = parseVideoUrl("https://www.youtube.com/watch?v=abc123&t=90");
    expect(result.startFromUrl).toBe(90);
  });

  it("reads an hms-style start timestamp from ?t=", () => {
    const result = parseVideoUrl("https://www.youtube.com/watch?v=abc123&t=1h2m3s");
    expect(result.startFromUrl).toBe(1 * 3600 + 2 * 60 + 3);
  });

  it("returns null for a youtube URL with no video id", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch")).toBeNull();
  });

  it("parses a tiktok video URL", () => {
    const result = parseVideoUrl("https://www.tiktok.com/@someone/video/7123456789012345678");
    expect(result).toEqual({ platform: "tiktok", videoId: "7123456789012345678", aspectRatio: 9 / 16 });
  });

  it("rejects a tiktok URL with a non-numeric video id", () => {
    expect(parseVideoUrl("https://www.tiktok.com/@someone/video/not-a-number")).toBeNull();
  });

  it("parses an x.com status URL", () => {
    const result = parseVideoUrl("https://x.com/someone/status/1234567890");
    expect(result).toEqual({ platform: "twitter", tweetId: "1234567890" });
  });

  it("parses a legacy twitter.com status URL", () => {
    const result = parseVideoUrl("https://twitter.com/someone/status/1234567890");
    expect(result.platform).toBe("twitter");
    expect(result.tweetId).toBe("1234567890");
  });
});
