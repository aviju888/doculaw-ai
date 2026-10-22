// Public API origin only. Never expose provider keys through Vite environment variables.
export function apiURL(path: string): string {
  const base = (
    import.meta.env.VITE_API_BASE_URL as string | undefined
  )?.replace(/\/$/, "");
  return base ? base + path.replace(/^\/api/, "") : path;
}
