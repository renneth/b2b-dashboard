import Link from "next/link";

import { NewOrderClient } from "@/components/new-order-client";
import { getDashboardData, readFixture } from "@/lib/fixtures";

export default async function NewOrderPage() {
	const data = await getDashboardData();
	const sampleCsv = await readFixture("sample_roster_upload.csv");
	const invalidCsv = await readFixture("sample_roster_upload_invalid.csv");

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
			<section className="grid gap-4 rounded-[28px] bg-(--panel) px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8">
				<div className="space-y-4">
					<p className="text-(--muted) text-xs font-semibold uppercase tracking-[0.3em]">
						New order
					</p>
					<div className="space-y-2">
						<h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
							Validate the roster, create a draft, then submit it back to the
							queue.
						</h1>
						<p className="max-w-xl text-(--muted) text-sm leading-6 sm:text-base">
							This page keeps upload, validation, and draft submission out of
							the main dashboard.
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<Link className="action-pill action-pill--primary" href="/">
							Back to dashboard
						</Link>
						<Link className="action-pill" href="/audit-logs">
							Audit logs
						</Link>
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
					<div className="metric-card">
						<span>Accounts</span>
						<strong>{data.accounts.length}</strong>
						<small>Available for new orders</small>
					</div>
					<div className="metric-card">
						<span>Workflow states</span>
						<strong>{data.workflow.statuses.length}</strong>
						<small>Draft returns to dashboard at submission</small>
					</div>
				</div>
			</section>

			<NewOrderClient
				initialData={data}
				sampleCsv={sampleCsv}
				invalidCsv={invalidCsv}
			/>
		</main>
	);
}
