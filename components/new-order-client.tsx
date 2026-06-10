"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type {
	Account,
	DashboardData,
	OrderRecord,
	ValidationIssue,
	ValidationResult,
} from "@/lib/types";

interface NewOrderClientProps {
	initialData: DashboardData;
	sampleCsv: string;
	invalidCsv: string;
}

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
		default:
			return null;
	}
}

function renderIssues(issues: ValidationIssue[]): string {
	if (issues.length === 0) {
		return "No issues";
	}

	return `${issues.length} issue${issues.length === 1 ? "" : "s"}`;
}

export function NewOrderClient({
	initialData,
	sampleCsv,
	invalidCsv,
}: NewOrderClientProps) {
	const router = useRouter();
	const [accountId, setAccountId] = useState(
		initialData.accounts[0]?.accountId ?? "",
	);
	const [csvText, setCsvText] = useState(sampleCsv);
	const [validation, setValidation] = useState<ValidationResult | null>(null);
	const [draftOrder, setDraftOrder] = useState<OrderRecord | null>(null);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const selectedAccount = useMemo(() => {
		return (
			initialData.accounts.find((account) => account.accountId === accountId) ??
			initialData.accounts[0]
		);
	}, [accountId, initialData.accounts]);

	const accountSummary = selectedAccount as Account | undefined;
	const draftAction = getAction(draftOrder);

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

	function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
		const file = event.target.files?.[0];

		if (!file) {
			return;
		}

		void file.text().then((text) => {
			setCsvText(text);
			setValidation(null);
			setDraftOrder(null);
			setFeedback(`Loaded ${file.name}`);
		});
	}

	function resetNewOrderFlow(nextCsv = sampleCsv): void {
		setCsvText(nextCsv);
		setValidation(null);
		setDraftOrder(null);
	}

	function handleAccountChange(nextAccountId: string): void {
		setAccountId(nextAccountId);
		setValidation(null);
		setDraftOrder(null);
		setFeedback(null);
	}

	function runValidation(): void {
		startTransition(() => {
			void postJson<ValidationResult>("/api/roster", {
				accountId,
				csvText,
			})
				.then((result) => {
					setValidation(result);
					setDraftOrder(null);
					setFeedback(
						result.issues.length === 0
							? "Roster valid"
							: `Validation found ${renderIssues(result.issues)}`,
					);
				})
				.catch((error: Error) => {
					setFeedback(error.message);
				});
		});
	}

	function createOrder(): void {
		if (!validation || validation.issues.length > 0) {
			return;
		}

		startTransition(() => {
			void postJson<OrderRecord>("/api/orders", {
				accountId,
				rows: validation.rows,
			})
				.then((result) => {
					setDraftOrder(result);
					setFeedback(
						`Draft ${result.externalOrderRef} created. Submit to add it to the dashboard.`,
					);
				})
				.catch((error: Error) => {
					setFeedback(error.message);
				});
		});
	}

	function submitDraftOrder(action: string): void {
		if (!draftOrder) {
			return;
		}

		startTransition(() => {
			void postJson<OrderRecord>(`/api/orders/${draftOrder.id}/transition`, {
				action,
			})
				.then((result) => {
					if (result.status === "Submitted") {
						router.push("/");
						router.refresh();
						return;
					}

					setDraftOrder(result);
					setFeedback(`Status moved to ${result.status}`);
				})
				.catch((error: Error) => {
					setFeedback(error.message);
				});
		});
	}

	return (
		<section className="grid gap-4">
			<article className="panel-block gap-4">
				<div className="panel-head">
					<div>
						<p>New order</p>
						<h2>Upload and validate</h2>
					</div>
					<div className="flex flex-wrap gap-2">
						<div className="panel-chip">
							{accountSummary?.accountName ?? "Account"}
						</div>
						<Link className="action-pill" href="/">
							Back to dashboard
						</Link>
					</div>
				</div>

				<div className="form-grid">
					<label className="field-block">
						<span>Account</span>
						<select
							value={accountId}
							onChange={(event) => handleAccountChange(event.target.value)}>
							{initialData.accounts.map((account) => (
								<option key={account.accountId} value={account.accountId}>
									{account.accountName}
								</option>
							))}
						</select>
					</label>

					<label className="field-block">
						<span>CSV</span>
						<input
							type="file"
							accept=".csv,text/csv"
							onChange={handleFileChange}
						/>
					</label>
				</div>

				<div className="flex flex-wrap gap-2">
					<button
						className="action-pill action-pill--primary"
						onClick={runValidation}
						type="button">
						{isPending ? "Working" : "Validate"}
					</button>
					<button
						className="action-pill"
						onClick={() => resetNewOrderFlow(sampleCsv)}
						type="button">
						Use Valid Sample
					</button>
					<button
						className="action-pill"
						onClick={() => resetNewOrderFlow(invalidCsv)}
						type="button">
						Use Invalid Sample
					</button>
				</div>

				<label className="field-block">
					<span>Preview</span>
					<textarea
						value={csvText}
						onChange={(event) => setCsvText(event.target.value)}
						rows={8}
					/>
				</label>

				<div className="metric-row">
					<div className="metric-card metric-card--dense">
						<span>Discount</span>
						<strong>{accountSummary?.discountPct ?? 0}%</strong>
					</div>
					<div className="metric-card metric-card--dense">
						<span>Deposit</span>
						<strong>{accountSummary?.requiresDeposit ? "Yes" : "No"}</strong>
					</div>
					<div className="metric-card metric-card--dense">
						<span>Status</span>
						<strong>{feedback ?? "Ready"}</strong>
					</div>
				</div>
			</article>

			<article className="panel-block gap-4">
				<div className="panel-head">
					<div>
						<p>Review</p>
						<h2>Validation and quote</h2>
					</div>
					<div className="panel-chip panel-chip--alert">
						{validation ? renderIssues(validation.issues) : "Not checked"}
					</div>
				</div>

				{validation ? (
					<>
						{validation.issues.length > 0 ? (
							<ul className="issue-list">
								{validation.issues.map((issue) => (
									<li key={`${issue.rowNumber}-${issue.message}`}>
										<strong>Row {issue.rowNumber}</strong>
										<span>
											{issue.playerName} - {issue.message}
										</span>
									</li>
								))}
							</ul>
						) : (
							<>
								<div className="metric-row">
									<div className="metric-card metric-card--dense">
										<span>Lines</span>
										<strong>{validation.quote.lines.length}</strong>
									</div>
									<div className="metric-card metric-card--dense">
										<span>Units</span>
										<strong>{validation.quote.unitCount}</strong>
									</div>
									<div className="metric-card metric-card--dense">
										<span>Total</span>
										<strong>{formatCurrency(validation.quote.total)}</strong>
									</div>
								</div>
								<div className="overflow-x-auto">
									<table className="data-table">
										<thead>
											<tr>
												<th>Player</th>
												<th>SKU</th>
												<th>Qty</th>
												<th>Pack</th>
												<th>Line</th>
											</tr>
										</thead>
										<tbody>
											{validation.quote.lines.map((line) => (
												<tr
													key={`${line.playerName}-${line.sku}-${line.packGroup}`}>
													<td>
														<strong>{line.playerName}</strong>
														<span>{line.team}</span>
													</td>
													<td>
														<strong>{line.sku}</strong>
														<span>{line.size}</span>
													</td>
													<td>{line.quantity}</td>
													<td>{line.packGroup}</td>
													<td>{formatCurrency(line.subtotal)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<button
									className="action-pill action-pill--primary"
									onClick={createOrder}
									type="button">
									{isPending ? "Working" : "Create order"}
								</button>
							</>
						)}
					</>
				) : (
					<p className="text-sm text-[var(--muted)]">
						Run validation to see row checks and pricing.
					</p>
				)}
			</article>

			<article className="panel-block gap-4">
				<div className="panel-head">
					<div>
						<p>Submission</p>
						<h2>Submit to dashboard</h2>
					</div>
					<div className="panel-chip">{draftOrder?.status ?? "No draft"}</div>
				</div>

				{draftOrder ? (
					<div className="grid gap-4">
						<section className="grid gap-3">
							<div className="metric-row">
								<div className="metric-card metric-card--dense">
									<span>Order</span>
									<strong>{draftOrder.externalOrderRef}</strong>
								</div>
								<div className="metric-card metric-card--dense">
									<span>Total</span>
									<strong>{formatCurrency(draftOrder.quote.total)}</strong>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								{draftAction ? (
									<button
										className="action-pill action-pill--primary"
										onClick={() => submitDraftOrder(draftAction.value)}
										type="button">
										{isPending ? "Working" : draftAction.label}
									</button>
								) : null}
							</div>
							<p className="text-sm text-[var(--muted)]">
								Submitting this draft returns you to the dashboard, where the
								order will appear in the queue.
							</p>
						</section>

						<section className="grid gap-3">
							<div className="panel-head">
								<div>
									<p>Pick list</p>
									<h2>Grouped by pack</h2>
								</div>
							</div>
							<div className="pick-grid">
								{draftOrder.pickGroups.map((group) => (
									<div key={group.packGroup} className="pick-card">
										<strong>{group.packGroup}</strong>
										<span>
											<b>{group.totalUnits} units</b>
										</span>
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

						<section className="grid gap-3">
							<div className="panel-head">
								<div>
									<p>Audit</p>
									<h2>Events</h2>
								</div>
							</div>
							<ul className="issue-list">
								{draftOrder.auditLog.map((event) => (
									<li key={event.id}>
										<strong>{event.type}</strong>
										<span>{new Date(event.at).toLocaleString("en-AU")}</span>
										<span>{event.message}</span>
									</li>
								))}
							</ul>
						</section>
					</div>
				) : (
					<p className="text-sm text-[var(--muted)]">
						Create a draft order from the review panel, then submit it to move
						it onto the main dashboard.
					</p>
				)}
			</article>
		</section>
	);
}
