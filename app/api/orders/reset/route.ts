import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { clearOrders } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearOrders();
    revalidatePath("/");
    revalidatePath("/new-order");
    revalidatePath("/audit-logs");
    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to clear orders." },
      { status: 500 },
    );
  }
}