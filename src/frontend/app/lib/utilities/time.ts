export function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return "Unknown time";

  const date = new Date(timestamp);

  return date.toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

}