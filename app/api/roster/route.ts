import { NextResponse } from "next/server";

import { validateRosterCsv } from "@/lib/fixtures";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      accountId?: string;
      csvText?: string;
    };

    if (!body.csvText || typeof body.csvText !== "string") {
      return NextResponse.json({ error: "CSV text is required." }, { status: 400 });
    }

    const result = await validateRosterCsv(body.accountId ?? "", body.csvText);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed." },
      { status: 500 },
    );
  }
}