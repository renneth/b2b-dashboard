import Link from "next/link";

import { listAuditFeed } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
	const auditFeed = await listAuditFeed();

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
			<section className="grid gap-4 rounded-[28px] bg-(--panel) px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:px-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8">
				<div className="space-y-3">
					<p className="text-(--muted) text-xs font-semibold uppercase tracking-[0.3em]">
						Audit logs
					</p>
					<div className="space-y-2">
						<h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
							Global activity feed for the demo order lifecycle.
						</h1>
						<p className="max-w-xl text-(--muted) text-sm leading-6 sm:text-base">
							Review every order, approval, ERP, warehouse, and invoice event in
							reverse chronological order.
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<Link className="action-pill action-pill--primary" href="/">
							Back to dashboard
						</Link>
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
					<div className="metric-card">
						<span>Events</span>
						<strong>{auditFeed.length}</strong>
						<small>Across all stored demo orders</small>
					</div>
					<div className="metric-card">
						<span>Orders touched</span>
						<strong>
							{new Set(auditFeed.map((event) => event.orderId)).size}
						</strong>
						<small>Persisted JSON-backed demo store</small>
					</div>
				</div>
			</section>

			<section className="panel-block gap-4">
				<div className="panel-head">
					<div>
						<p>Feed</p>
						<h2>Latest events first</h2>
					</div>
					<div className="panel-chip">{auditFeed.length} events</div>
				</div>

				{auditFeed.length > 0 ? (
					<ul className="issue-list">
						{auditFeed.map((event) => (
							<li key={event.id}>
								<strong>
									{event.externalOrderRef} · {event.type}
								</strong>
								<span>{event.accountName}</span>
								<span>
									{event.status} · {new Date(event.at).toLocaleString("en-AU")}
								</span>
								<span>{event.message}</span>
							</li>
						))}
					</ul>
				) : (
					<p className="text-(--muted) text-sm">
						No audit events yet. Create and submit an order from the dashboard
						to populate this screen.
					</p>
				)}
			</section>
		</main>
	);
}
