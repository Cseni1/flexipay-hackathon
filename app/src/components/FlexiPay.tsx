import { useMemo, useState } from "react"
import styles from "./FlexiPay.module.css"

const HOURLY_RATE = 14
const HOURS = 8
const GROSS = HOURLY_RATE * HOURS

const EMPLOYER_ADDRESS =
	import.meta.env.PUBLIC_EMPLOYER_ADDRESS ||
	"GDNFGHPOIPM3RHL7NMQCXRAELEF6AVFJLLOFXM25DDN4ANXMMTU3LFZP"
const WORKER_ADDRESS =
	import.meta.env.PUBLIC_WORKER_ADDRESS ||
	"GADUBNTO655LVGIRUH3SP7E4P5FRUL2TWWURNDYQOQ3KMPD3B72WYJHL"
const CONTRACT_ID = import.meta.env.PUBLIC_PAY_SHIFT_CONTRACT_ID || ""

type View = "worker" | "employer"
type ShiftStatus = "scheduled" | "clocked_in" | "completed" | "paid"

type PaymentProof = {
	transactionHash: string | null
	explorerUrl: string | null
	amountXlm: string
	contractId: string
	employer: string
	worker: string
	timestamp: string
}

const money = (n: number) =>
	n.toLocaleString("en-GB", { style: "currency", currency: "GBP" })

function newShiftId() {
	const d = new Date()
	const stamp = `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getFullYear()).slice(2)}`
	const seq = String(Math.floor(Math.random() * 900) + 100)
	return `FW-${stamp}-${seq}`
}

export default function FlexiPay() {
	const [view, setView] = useState<View>("worker")
	const [status, setStatus] = useState<ShiftStatus>("scheduled")
	const [shiftId, setShiftId] = useState("FW-120926-001")
	const [payStep, setPayStep] = useState<string | null>(null)
	const [payError, setPayError] = useState<string | null>(null)
	const [proof, setProof] = useState<PaymentProof | null>(null)

	const statusLabel = useMemo(() => {
		switch (status) {
			case "scheduled":
				return "Ready to clock in"
			case "clocked_in":
				return "On shift"
			case "completed":
				return "Awaiting employer approval"
			case "paid":
				return "PAID"
			default:
				return ""
		}
	}, [status])

	const clockIn = () => setStatus("clocked_in")
	const clockOut = () => {
		setShiftId(newShiftId())
		setProof(null)
		setPayError(null)
		setStatus("completed")
	}

	const approveAndPay = async () => {
		if (status === "paid") return
		setPayError(null)
		const steps = [
			"Approving Sarah's shift...",
			"Authorising payment on Stellar Testnet...",
			"Submitting transaction...",
			"Waiting for settlement...",
		]
		try {
			for (const step of steps) {
				setPayStep(step)
				await new Promise((r) => setTimeout(r, 450))
			}
			const res = await fetch(`/api/pay`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ shiftId }),
			})
			const data = (await res.json()) as {
				ok?: boolean
				error?: string
				transactionHash?: string | null
				explorerUrl?: string | null
				amountXlm?: string
				contractId?: string
				employer?: string
				worker?: string
				timestamp?: string
			}
			if (!res.ok || !data.ok) {
				const msg = String(data.error || "Payment failed")
				if (msg.includes("Error(Contract, #1)") || msg.includes("AlreadyPaid")) {
					throw new Error(
						"This shift was already paid on-chain (duplicate protection).",
					)
				}
				throw new Error(msg)
			}
			setProof({
				transactionHash: data.transactionHash ?? null,
				explorerUrl: data.explorerUrl ?? null,
				amountXlm: data.amountXlm || "1",
				contractId: data.contractId || CONTRACT_ID,
				employer: data.employer || EMPLOYER_ADDRESS,
				worker: data.worker || WORKER_ADDRESS,
				timestamp: data.timestamp || new Date().toISOString(),
			})
			setStatus("paid")
			setPayStep(null)
		} catch (e) {
			setPayStep(null)
			setPayError(e instanceof Error ? e.message : String(e))
		}
	}

	return (
		<div className={styles.shell}>
			<header className={styles.topbar}>
				<div>
					<p className={styles.brand}>FLEXIPAY</p>
					<p className={styles.tagline}>
						Work a shift. Get paid when it is approved.
					</p>
				</div>
				<div className={styles.toggle} role="tablist" aria-label="View mode">
					<button
						type="button"
						className={view === "worker" ? styles.toggleActive : ""}
						onClick={() => setView("worker")}
					>
						Worker
					</button>
					<button
						type="button"
						className={view === "employer" ? styles.toggleActive : ""}
						onClick={() => setView("employer")}
					>
						Employer
					</button>
				</div>
			</header>

			<main className={styles.main}>
				{view === "worker" ? (
					<section className={styles.card}>
						<div className={styles.person}>
							<div>
								<h1>Sarah Ahmed</h1>
								<p>Chef · The Crown Hotel</p>
							</div>
							<span
								className={`${styles.badge} ${styles[`badge_${status}`]}`}
							>
								{statusLabel}
							</span>
						</div>

						<h2>Today&apos;s Shift</h2>
						<dl className={styles.meta}>
							<div>
								<dt>Scheduled</dt>
								<dd>14:00–22:00</dd>
							</div>
							<div>
								<dt>Hourly rate</dt>
								<dd>{money(HOURLY_RATE)}/hour</dd>
							</div>
							<div>
								<dt>Shift ID</dt>
								<dd>{shiftId}</dd>
							</div>
						</dl>

						{status === "scheduled" && (
							<button
								type="button"
								className={styles.primary}
								onClick={clockIn}
							>
								CLOCK IN
							</button>
						)}

						{status === "clocked_in" && (
							<>
								<p className={styles.notice}>CLOCKED IN · Demo clock: 14:00</p>
								<button
									type="button"
									className={styles.primary}
									onClick={clockOut}
								>
									CLOCK OUT
								</button>
							</>
						)}

						{(status === "completed" || status === "paid") && (
							<div className={styles.result}>
								<h3>{status === "paid" ? "PAID ✓" : "SHIFT COMPLETED"}</h3>
								<p>
									{HOURS.toFixed(1)} hours worked
									<br />
									<strong>{money(GROSS)} earned</strong>
								</p>
								{status === "completed" && (
									<p className={styles.muted}>Awaiting employer approval</p>
								)}
								{status === "paid" && proof && (
									<>
										<p>Your shift has been approved.</p>
										<p className={styles.settlement}>
											Testnet settlement received:{" "}
											<strong>{proof.amountXlm} XLM TESTNET</strong>
										</p>
										{proof.explorerUrl && (
											<a
												className={styles.link}
												href={proof.explorerUrl}
												target="_blank"
												rel="noreferrer"
											>
												View transaction
											</a>
										)}
									</>
								)}
							</div>
						)}
					</section>
				) : (
					<section className={styles.card}>
						{status === "scheduled" || status === "clocked_in" ? (
							<>
								<h2>No shifts awaiting approval</h2>
								<p className={styles.muted}>
									Switch to Worker view, clock in and clock out to complete a
									shift.
								</p>
							</>
						) : (
							<>
								<p className={styles.eyebrow}>
									{status === "paid"
										? "PAYMENT SENT ✓"
										: "SHIFT AWAITING APPROVAL"}
								</p>
								<div className={styles.person}>
									<div>
										<h1>Sarah Ahmed</h1>
										<p>Chef · The Crown Hotel</p>
									</div>
								</div>

								<dl className={styles.meta}>
									<div>
										<dt>Clock in</dt>
										<dd>14:00</dd>
									</div>
									<div>
										<dt>Clock out</dt>
										<dd>22:00</dd>
									</div>
									<div>
										<dt>Hours</dt>
										<dd>{HOURS.toFixed(1)}</dd>
									</div>
									<div>
										<dt>Rate</dt>
										<dd>{money(HOURLY_RATE)}/hour</dd>
									</div>
									<div>
										<dt>Shift ID</dt>
										<dd>{shiftId}</dd>
									</div>
								</dl>

								<div className={styles.totalBlock}>
									<p>TOTAL EARNED</p>
									<p className={styles.total}>{money(GROSS)}</p>
									<p className={styles.muted}>
										Gross earnings (wage calculation)
									</p>
								</div>

								{status === "completed" && (
									<>
										<button
											type="button"
											className={styles.primary}
											onClick={approveAndPay}
											disabled={!!payStep}
										>
											{payStep ? "Processing…" : "APPROVE & PAY"}
										</button>
										{payStep && <p className={styles.notice}>{payStep}</p>}
										{payError && <p className={styles.error}>{payError}</p>}
										<p className={styles.fine}>
											Hackathon Testnet prototype · settles 1 XLM TESTNET via
											Soroban
										</p>
									</>
								)}

								{status === "paid" && proof && (
									<div className={styles.proof}>
										<h3>PAYMENT SENT ✓</h3>
										<p>
											Sarah has been paid for shift:{" "}
											<strong>{shiftId}</strong>
										</p>
										<dl className={styles.meta}>
											<div>
												<dt>Gross earnings</dt>
												<dd>{money(GROSS)}</dd>
											</div>
											<div>
												<dt>Testnet settlement</dt>
												<dd>{proof.amountXlm} XLM TESTNET</dd>
											</div>
											<div>
												<dt>Status</dt>
												<dd>PAID</dd>
											</div>
											<div>
												<dt>Worker</dt>
												<dd>{proof.worker}</dd>
											</div>
											<div>
												<dt>Employer</dt>
												<dd>{proof.employer}</dd>
											</div>
											<div>
												<dt>Soroban contract</dt>
												<dd>{proof.contractId}</dd>
											</div>
											<div>
												<dt>Transaction hash</dt>
												<dd>{proof.transactionHash || "—"}</dd>
											</div>
											<div>
												<dt>Timestamp</dt>
												<dd>{new Date(proof.timestamp).toLocaleString()}</dd>
											</div>
										</dl>
										{proof.explorerUrl && (
											<a
												className={styles.primary}
												href={proof.explorerUrl}
												target="_blank"
												rel="noreferrer"
											>
												VIEW TRANSACTION
											</a>
										)}
									</div>
								)}
							</>
						)}
					</section>
				)}
			</main>

			<footer className={styles.footer}>
				Payments powered by Stellar · Hackathon Testnet prototype
			</footer>
		</div>
	)
}
