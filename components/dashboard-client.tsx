"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { DashboardData, OrderRecord } from "@/lib/types";

interface DashboardClientProps {
	initialData: DashboardData;
	initialOrders: OrderRecord[];
}

type QueueFilter = "All" | OrderRecord["status"];

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		maximumFractionDigits: 2,
	}).format(value);
}

function getAction(
	order: OrderRecord | null,
): { label: string; value: string } | null {
	if (!order) {
		return null;
	}

	switch (order.status) {
		case "Draft":
			return { label: "Submit", value: "submit" };
		case "Submitted":
			return { label: "Open design", value: "await_design" };
		case "Awaiting Design":
			return { label: "Approve + lock", value: "approve_design" };
		case "Design Approved / Locked":
			return { label: "Queue ERP", value: "queue_erp" };
		case "ERP Sync Pending":
			return { label: "Mark synced", value: "mark_erp_synced" };
		case "ERP Synced":
			return { label: "Start picking", value: "start_picking" };
		case "Picking":
			return { label: "Mark packed", value: "mark_packed" };
		case "Packed":
			return { label: "Create invoice", value: "create_invoice" };
		default:
			return null;
	}
}

export function DashboardClient({
	initialData,
	initialOrders,
}: DashboardClientProps) {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [orders, setOrders] = useState(initialOrders);
	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
	const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
	const [isClearing, setIsClearing] = useState(false);
	const [isPending, startTransition] = useTransition();

	const queueFilter = useMemo<QueueFilter>(() => {
		const rawFilter = searchParams.get("status");

		if (!rawFilter) {
			return "All";
		}

		return initialData.workflow.statuses.includes(
			rawFilter as OrderRecord["status"],
		)
			? (rawFilter as QueueFilter)
			: "All";
	}, [initialData.workflow.statuses, searchParams]);

	const ongoingValue = useMemo(() => {
		return orders.reduce((sum, order) => sum + order.quote.total, 0);
	}, [orders]);

	const activeStatuses = useMemo(() => {
		return new Set(orders.map((order) => order.status));
	}, [orders]);

	const statusCounts = useMemo(() => {
		return orders.reduce<Record<OrderRecord["status"], number>>(
			(counts, order) => {
				counts[order.status] = (counts[order.status] ?? 0) + 1;
				return counts;
			},
			{} as Record<OrderRecord["status"], number>,
		);
	}, [orders]);

	const filteredOrders = useMemo(() => {
		if (queueFilter === "All") {
			return orders;
		}

		return orders.filter((order) => order.status === queueFilter);
	}, [orders, queueFilter]);

	const selectedOrder = useMemo(() => {
		if (!selectedOrderId) {
			return null;
		}

		return filteredOrders.find((order) => order.id === selectedOrderId) ?? null;
	}, [filteredOrders, selectedOrderId]);

	const currentStepIndex = useMemo(() => {
		if (!selectedOrder) {
			return -1;
		}

		return initialData.workflow.statuses.indexOf(selectedOrder.status);
	}, [initialData.workflow.statuses, selectedOrder]);

	const nextAction = getAction(selectedOrder);

	useEffect(() => {
		let isActive = true;

		void fetch("/api/orders", { cache: "no-store" })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error("Unable to refresh orders.");
				}

				return (await response.json()) as OrderRecord[];
			})
			.then((latestOrders) => {
				if (!isActive) {
					return;
				}

				setOrders(latestOrders);
			})
			.catch(() => {
				// Keep the server-provided orders when the refresh request fails.
			});

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		if (!isProgressModalOpen) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape") {
				setIsProgressModalOpen(false);
			}
		}

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isProgressModalOpen]);

	async function postJson<T>(
		url: string,
		body: Record<string, unknown>,
	): Promise<T> {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const payload = (await response.json()) as T & { error?: string };

		if (!response.ok) {
			throw new Error(payload.error ?? "Request failed.");
		}

		return payload;
	}

	function upsertOrder(nextOrder: OrderRecord): void {
		setOrders((current) => {
			const remaining = current.filter((order) => order.id !== nextOrder.id);

			return [nextOrder, ...remaining].sort((left, right) =>
				right.createdAt.localeCompare(left.createdAt),
			);
		});
	}

	function updateQueueFilter(nextFilter: QueueFilter): void {
		const params = new URLSearchParams(searchParams.toString());

		if (nextFilter === "All") {
			params.delete("status");
		} else {
			params.set("status", nextFilter);
		}

		const nextQuery = params.toString();
		router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
			scroll: false,
		});
	}

	function advanceDashboardOrder(action: string): void {
		if (!selectedOrder) {
			return;
		}

		startTransition(() => {
			void postJson<OrderRecord>(`/api/orders/${selectedOrder.id}/transition`, {
				action,
			})
				.then((result) => {
					upsertOrder(result);
					setSelectedOrderId(result.id);
					if (queueFilter !== "All" && queueFilter !== result.status) {
						updateQueueFilter(result.status);
					}
					setFeedback(`Status moved to ${result.status}`);
				})
				.catch((error: Error) => {
					setFeedback(error.message);
				});
		});
	}

	function openClearConfirm(): void {
		setIsClearConfirmOpen(true);
	}

	function closeClearConfirm(): void {
		if (isClearing) {
			return;
		}

		setIsClearConfirmOpen(false);
	}

	async function clearDemoOrders(): Promise<void> {
		setIsClearing(true);

		try {
			await postJson<{ ok: boolean }>("/api/orders/reset", {});
			setOrders([]);
			setSelectedOrderId(null);
			setIsProgressModalOpen(false);
			setIsClearConfirmOpen(false);
			setFeedback("Demo orders cleared.");
			router.refresh();
		} catch (error) {
			setFeedback(
				error instanceof Error ? error.message : "Unable to clear demo orders.",
			);
		} finally {
			setIsClearing(false);
		}
	}

	function handleFilterChange(nextFilter: QueueFilter): void {
		updateQueueFilter(nextFilter);
	}

	function closeProgressModal(): void {
		setIsProgressModalOpen(false);
	}

	return (
		<>
			<section className="grid gap-4">
				<article className="panel-block gap-4">
					<div className="panel-head">
						<div>
							<h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
								B2B dashboard
							</h1>
							<h2>All stored orders</h2>
						</div>
						<div className="panel-chip">{orders.length} total</div>
					</div>

					<div className="metric-row">
						<div className="metric-card metric-card--dense">
							<span>Live value</span>
							<strong>{formatCurrency(ongoingValue)}</strong>
						</div>
						<div className="metric-card metric-card--dense">
							<span>Accounts</span>
							<strong>
								{new Set(orders.map((order) => order.account.accountId)).size}
							</strong>
						</div>
						<div className="metric-card metric-card--dense">
							<span>Status mix</span>
							<strong>{activeStatuses.size || 0}</strong>
						</div>
						<div className="metric-card metric-card--dense">
							<span>Activity</span>
							<strong>{feedback ?? "Ready"}</strong>
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						<Link
							className="action-pill action-pill--primary"
							href="/new-order">
							New order
						</Link>
						<Link className="action-pill" href="/audit-logs">
							Audit logs
						</Link>
						<button
							className="action-pill"
							disabled={isClearing}
							onClick={openClearConfirm}
							type="button">
							{isClearing ? "Working" : "Clear demo data"}
						</button>
					</div>
				</article>

				<section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
					<article className="panel-block panel-block--stable gap-4">
						<div className="panel-head">
							<div>
								<p>Queue</p>
								<h2>All orders</h2>
							</div>
							<div className="panel-chip">{filteredOrders.length} shown</div>
						</div>

						<div className="queue-filter-bar">
							<button
								className={`filter-toggle ${queueFilter === "All" ? "filter-toggle--active" : ""}`}
								onClick={() => handleFilterChange("All")}
								type="button">
								All ({orders.length})
							</button>
							{initialData.workflow.statuses.map((status) =>
								(() => {
									const count = statusCounts[status] ?? 0;
									const isDisabled = count === 0;

									return (
										<button
											key={status}
											className={`filter-toggle ${queueFilter === status ? "filter-toggle--active" : ""} ${isDisabled ? "filter-toggle--disabled" : ""}`}
											disabled={isDisabled}
											onClick={() => handleFilterChange(status)}
											type="button">
											{status} ({count})
										</button>
									);
								})(),
							)}
						</div>

						{filteredOrders.length > 0 ? (
							<ul className="issue-list issue-list--scrollable">
								{filteredOrders.map((order) => {
									const isSelected = order.id === selectedOrderId;

									return (
										<li
											key={order.id}
											className={
												isSelected
													? "queue-card queue-card--selected"
													: "queue-card"
											}>
											<button
												className="queue-card__button"
												onClick={() => setSelectedOrderId(order.id)}
												type="button">
												<div className="queue-card__title-row">
													<strong>{order.externalOrderRef}</strong>
													{isSelected ? (
														<span className="queue-selected-badge">
															Selected
														</span>
													) : null}
												</div>
												<span>{order.account.accountName}</span>
												<span>
													{order.status} · {formatCurrency(order.quote.total)} ·{" "}
													{new Date(order.createdAt).toLocaleDateString(
														"en-AU",
													)}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						) : (
							<div className="grid gap-3 rounded-[1.25rem] border border-[rgba(221,211,191,0.75)] bg-[rgba(255,255,255,0.55)] p-5">
								<strong>No matching orders</strong>
								<p className="text-(--muted) text-sm">
									Change the filter or create a new order to populate this
									queue.
								</p>
								<div className="flex flex-wrap gap-2">
									<Link
										className="action-pill action-pill--primary"
										href="/new-order">
										New order
									</Link>
									<Link className="action-pill" href="/audit-logs">
										View audit logs
									</Link>
								</div>
							</div>
						)}
					</article>

					<article className="panel-block panel-block--stable gap-4">
						<div className="panel-head">
							<div>
								<p>Order detail</p>
								<h2>Shows order information and audit trail</h2>
							</div>
							<div className="panel-chip">
								{selectedOrder?.status ?? "Select an order"}
							</div>
						</div>

						{selectedOrder ? (
							<div className="detail-layout">
								<section className="detail-stack">
									<div className="metric-row">
										<div className="metric-card metric-card--dense">
											<span>Order</span>
											<strong>{selectedOrder.externalOrderRef}</strong>
										</div>
										<div className="metric-card metric-card--dense">
											<span>Total</span>
											<strong>
												{formatCurrency(selectedOrder.quote.total)}
											</strong>
										</div>
									</div>
									<div className="grid gap-3 rounded-2xl border border-[rgba(221,211,191,0.85)] bg-[rgba(255,255,255,0.55)] p-4">
										<div className="flex items-start justify-between gap-3">
											<div className="grid gap-1">
												<span className="text-(--muted) text-xs font-semibold uppercase tracking-[0.14em]">
													Current step
												</span>
												<strong>{selectedOrder.status}</strong>
												<span className="text-(--muted) text-sm">
													{currentStepIndex + 1} of{" "}
													{initialData.workflow.statuses.length}
												</span>
											</div>
											<button
												className="action-pill"
												onClick={() => setIsProgressModalOpen(true)}
												type="button">
												View progress
											</button>
										</div>
										{nextAction ? (
											<button
												className="action-pill action-pill--primary"
												onClick={() => advanceDashboardOrder(nextAction.value)}
												type="button">
												{isPending ? "Working" : nextAction.label}
											</button>
										) : null}
									</div>

									<section className="grid gap-3">
										<div className="panel-head">
											<div>
												<p>Audit</p>
												<h2>Events</h2>
											</div>
										</div>
										<ul className="issue-list detail-audit-list">
											{selectedOrder.auditLog.map((event) => (
												<li key={event.id}>
													<strong>{event.type}</strong>
													<span>
														{new Date(event.at).toLocaleString("en-AU")}
													</span>
													<span>{event.message}</span>
												</li>
											))}
										</ul>
									</section>
									<section className="grid gap-3 xl:grid-cols-2">
										<label className="field-block">
											<span>ERP payload</span>
											<textarea
												readOnly
												rows={8}
												value={
													selectedOrder.erpPayload
														? JSON.stringify(selectedOrder.erpPayload, null, 2)
														: "Not created"
												}
											/>
										</label>
										<label className="field-block">
											<span>Invoice payload</span>
											<textarea
												readOnly
												rows={8}
												value={
													selectedOrder.invoicePayload
														? JSON.stringify(
																selectedOrder.invoicePayload,
																null,
																2,
															)
														: "Not created"
												}
											/>
										</label>
									</section>
								</section>

								<section className="detail-stack detail-stack--wide">
									<div className="panel-head">
										<div>
											<p>Pick list</p>
											<h2>Grouped by pack</h2>
										</div>
									</div>
									<div className="pick-grid">
										{selectedOrder.pickGroups.map((group) => (
											<div key={group.packGroup} className="pick-card">
												<strong>{group.packGroup}</strong>
												<span>{group.totalUnits} units</span>
												<ul>
													{group.lines.map((line) => (
														<li
															key={`${group.packGroup}-${line.playerName}-${line.sku}`}>
															{line.playerName} · {line.sku} · {line.quantity}
														</li>
													))}
												</ul>
											</div>
										))}
									</div>
								</section>
							</div>
						) : (
							<div className="grid gap-3 rounded-[1.25rem] border border-[rgba(221,211,191,0.75)] bg-[rgba(255,255,255,0.55)] p-5">
								<p className="text-(--muted) text-sm">
									Click any order in the queue to open its detail view, current
									step, pick list, and audit trail.
								</p>
							</div>
						)}
					</article>
				</section>
			</section>

			{isProgressModalOpen && selectedOrder ? (
				<div
					className="progress-modal-overlay"
					onClick={(event) => {
						if (event.target === event.currentTarget) {
							closeProgressModal();
						}
					}}
					role="presentation">
					<div
						className="progress-modal"
						onClick={(event) => event.stopPropagation()}>
						<div className="panel-head">
							<div>
								<p>Progress</p>
								<h2>{selectedOrder.externalOrderRef}</h2>
							</div>
							<button
								className="action-pill"
								onClick={closeProgressModal}
								type="button">
								Close
							</button>
						</div>

						<div className="progress-modal__summary">
							<span>Current step</span>
							<strong>{selectedOrder.status}</strong>
							<small>
								{currentStepIndex + 1} of {initialData.workflow.statuses.length}
							</small>
						</div>

						<ol className="status-list progress-modal__list">
							{initialData.workflow.statuses.map((status, index) => {
								const isActive = status === selectedOrder.status;
								const isComplete = index < currentStepIndex;

								return (
									<li
										key={status}
										className={isActive ? "status-list__item--active" : ""}>
										<span>
											{isActive
												? "Current"
												: isComplete
													? "Done"
													: `Step ${String(index + 1).padStart(2, "0")}`}
										</span>
										<strong>{status}</strong>
									</li>
								);
							})}
						</ol>
					</div>
				</div>
			) : null}

			{isClearConfirmOpen ? (
				<div
					className="progress-modal-overlay"
					onClick={(event) => {
						if (event.target === event.currentTarget) {
							closeClearConfirm();
						}
					}}
					role="presentation">
					<div
						className="progress-modal"
						onClick={(event) => event.stopPropagation()}>
						<div className="panel-head">
							<div>
								<p>Confirm reset</p>
								<h2>Clear demo data</h2>
							</div>
							<button
								className="action-pill"
								disabled={isClearing}
								onClick={closeClearConfirm}
								type="button">
								Cancel
							</button>
						</div>

						<div className="grid gap-4">
							<p className="text-(--muted) text-sm leading-6">
								This removes all stored demo orders and their audit history from
								the JSON-backed demo store.
							</p>
							<div className="flex flex-wrap justify-end gap-2">
								<button
									className="action-pill"
									disabled={isClearing}
									onClick={closeClearConfirm}
									type="button">
									Keep data
								</button>
								<button
									className="action-pill action-pill--primary"
									disabled={isClearing}
									onClick={() => {
										void clearDemoOrders();
									}}
									type="button">
									{isClearing ? "Clearing..." : "Clear demo data"}
								</button>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
