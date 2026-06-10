import { NextResponse } from "next/server";

import { listOngoingOrders } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listOngoingOrders(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}