import { NextResponse } from "next/server";

import { listOngoingOrders } from "@/lib/order-store";

export async function GET() {
  return NextResponse.json(await listOngoingOrders());
}