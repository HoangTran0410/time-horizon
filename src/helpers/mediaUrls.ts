/** Normalization of user-supplied image, video and external link URLs. */

const trimOptionalText = (value?: string | null): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const withHttpsForProtocolRelative = (value: string): string =>
  value.startsWith("//") ? `https:${value}` : value;

const withHttpsForKnownHosts = (value: string): string => {
  if (/^[a-z][a-z\d+.-]*:/iu.test(value)) return value;

  if (
    /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\b/iu.test(value) ||
    /^(?:[a-z-]+\.)?wikipedia\.org\b/iu.test(value)
  ) {
    return `https://${value}`;
  }

  return value;
};

const getYoutubeVideoIdFromUrl = (url: URL): string | null => {
  const hostname = url.hostname.replace(/^www\./iu, "").replace(/^m\./iu, "");

  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (!hostname.endsWith("youtube.com")) return null;

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  if (pathParts[0] && ["embed", "shorts", "live", "v"].includes(pathParts[0])) {
    return pathParts[1] ?? null;
  }

  return url.searchParams.get("v");
};

export const normalizeImageUrl = (image?: string): string | null => {
  const trimmed = trimOptionalText(image);
  if (!trimmed) return null;

  return withHttpsForProtocolRelative(trimmed);
};

export const normalizeEmbedVideoUrl = (video?: string): string | null => {
  const trimmed = trimOptionalText(video);
  if (!trimmed) return null;

  const normalizedInput = withHttpsForKnownHosts(
    withHttpsForProtocolRelative(trimmed),
  );

  if (/^https?:\/\//iu.test(normalizedInput)) {
    try {
      const url = new URL(normalizedInput);
      const videoId = getYoutubeVideoIdFromUrl(url);
      return videoId
        ? `https://www.youtube.com/embed/${videoId}`
        : normalizedInput;
    } catch {
      return normalizedInput;
    }
  }

  return `https://www.youtube.com/embed/${trimmed}`;
};

export const normalizeExternalLinkUrl = (link?: string): string | null => {
  const trimmed = trimOptionalText(link);
  if (!trimmed) return null;

  const normalizedInput = withHttpsForKnownHosts(
    withHttpsForProtocolRelative(trimmed),
  );

  if (/^https?:\/\//iu.test(normalizedInput)) {
    return normalizedInput;
  }

  const articleName = trimmed
    .replace(/^wiki\//iu, "")
    .trim()
    .replace(/\s+/gu, "_");

  return `https://en.wikipedia.org/wiki/${encodeURIComponent(articleName)}`;
};
