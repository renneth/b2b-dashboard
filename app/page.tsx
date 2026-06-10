import Link from "next/link";
import { Suspense } from "react";

import { getDashboardData } from "@/lib/fixtures";
import { listOrders } from "@/lib/order-store";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: 2,
	}).format(value);
}

export default async function Home() {
	const data = await getDashboardData();
	const allOrders = await listOrders();
	const liveStock = data.products.reduce(
		(sum, product) => sum + Math.max(product.stockOnHand - product.reserved, 0),
		0,
	);
	const liveValue = allOrders.reduce(
		(sum, order) => sum + order.quote.total,
		0,
	);

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
			<section id="dashboard-client">
				<Suspense
					fallback={<div className="panel-block">Loading dashboard...</div>}>
					<DashboardClient initialData={data} initialOrders={allOrders} />
				</Suspense>
			</section>
		</main>
	);
}
