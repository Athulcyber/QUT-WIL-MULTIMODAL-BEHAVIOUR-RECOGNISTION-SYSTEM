export const apiCore = {
  url: process.env.NEXT_PUBLIC_API_URL,
  headers(token: string) {
    return {
      "Cache-Control": "no-cache",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },
};

export const apiOrigin = (): string => {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return "";

  try {
    const url = new URL(base);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
};

export const activityWebSocketUrl = (accessToken: string): string => {
  const origin = apiOrigin();
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  if (origin) {
    const wsOrigin = origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    return `${wsOrigin}/api/v1/activity/ws?token=${accessToken}`;
  }

  return `${protocol}//${window.location.hostname}/api/v1/activity/ws?token=${accessToken}`;
};
