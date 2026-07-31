import type { NextRequest } from "next/server";
import { proxyStream } from "@/lib/proxy-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return proxyStream(req);
}
