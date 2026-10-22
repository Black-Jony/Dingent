export type ApiClientConfig = {
  baseURL: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  adapter?: "fetch" | "xhr" | "http";
};
