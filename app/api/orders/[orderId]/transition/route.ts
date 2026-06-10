import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { transitionOrder } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await context.params;
    const body = (await request.json()) as { action?: string };

    if (!body.action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    const order = await transitionOrder(orderId, body.action);
    revalidatePath("/");
    revalidatePath("/new-order");
    revalidatePath("/audit-logs");
    return NextResponse.json(order, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transition failed." },
      { status: 500 },
    );
  }
}