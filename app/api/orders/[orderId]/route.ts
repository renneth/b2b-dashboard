import { NextResponse } from "next/server";

import { getOrder } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const order = await getOrder(orderId);

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json(order, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}