import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createOrder, listOrders } from "@/lib/order-store";
import type { RosterRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listOrders(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      accountId?: string;
      rows?: RosterRow[];
    };

    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "Valid roster rows are required." }, { status: 400 });
    }

    const order = await createOrder(body.accountId ?? "", body.rows);
    revalidatePath("/");
    revalidatePath("/new-order");
    revalidatePath("/audit-logs");
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order creation failed." },
      { status: 500 },
    );
  }
}