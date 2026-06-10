import { NextResponse } from "next/server";

import { listAuditFeed } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAuditFeed(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}