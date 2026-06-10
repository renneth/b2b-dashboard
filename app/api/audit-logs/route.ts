import { NextResponse } from "next/server";

import { listAuditFeed } from "@/lib/order-store";

export async function GET() {
  return NextResponse.json(await listAuditFeed());
}