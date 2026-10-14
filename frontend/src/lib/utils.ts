import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayDocumentName(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || filename;
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const delta = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const intervals: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, milliseconds] of intervals) {
    if (Math.abs(delta) >= milliseconds) return formatter.format(Math.round(delta / milliseconds), unit);
  }
  return "just now";
}

export function getInitials(email?: string) {
  if (!email) return "U";
  const label = email.split("@")[0] || email;
  return label.slice(0, 2).toUpperCase();
}

export function citationMatchLevel(citation: { match_level?: string; score: number }) {
  const provided = citation.match_level?.toLowerCase();
  if (provided && ["low", "medium", "high", "exact"].includes(provided)) return provided;
  if (citation.score >= 0.95) return "exact";
  if (citation.score >= 0.6) return "high";
  if (citation.score >= 0.35) return "medium";
  return "low";
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
