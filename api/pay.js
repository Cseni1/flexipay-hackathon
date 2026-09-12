/**
 * Vercel serverless: Approve & Pay on Stellar Testnet.
 * Employer secret stays in EMPLOYER_SECRET (server env only) — never PUBLIC_*.
 */
const {
	Address,
	BASE_FEE,
	Contract,
	Keypair,
	Networks,
	TransactionBuilder,
	nativeToScVal,
	rpc,
} = require("@stellar/stellar-sdk")

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST,OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
}

function json(res, status, body) {
	res.statusCode = status
	res.setHeader("Content-Type", "application/json")
	for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v)
	res.end(JSON.stringify(body))
}

function requireEnv(name) {
	const v = process.env[name]
	if (!v) throw new Error(`Missing server env: ${name}`)
	return v
}

async function waitForTx(server, hash) {
	for (let i = 0; i < 45; i++) {
		const r = await server.getTransaction(hash)
		if (r.status === "SUCCESS") return r
		if (r.status === "FAILED") {
			const err = new Error("Transaction failed on Testnet")
			err.detail = r
			throw err
		}
		await new Promise((r) => setTimeout(r, 1000))
	}
	throw new Error("Timed out waiting for Testnet settlement")
}

async function payShift(shiftId) {
	const secret = requireEnv("EMPLOYER_SECRET")
	const contractId = requireEnv("PUBLIC_PAY_SHIFT_CONTRACT_ID")
	const tokenId =
		process.env.PUBLIC_NATIVE_TOKEN_CONTRACT_ID ||
		"CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
	const employer =
		process.env.PUBLIC_EMPLOYER_ADDRESS ||
		"GDNFGHPOIPM3RHL7NMQCXRAELEF6AVFJLLOFXM25DDN4ANXMMTU3LFZP"
	const worker =
		process.env.PUBLIC_WORKER_ADDRESS ||
		"GADUBNTO655LVGIRUH3SP7E4P5FRUL2TWWURNDYQOQ3KMPD3B72WYJHL"
	const rpcUrl =
		process.env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org"
	const amount = BigInt(process.env.DEMO_AMOUNT_STROOPS || "10000000")

	const keypair = Keypair.fromSecret(secret)
	if (keypair.publicKey() !== employer) {
		throw new Error("EMPLOYER_SECRET does not match PUBLIC_EMPLOYER_ADDRESS")
	}

	const server = new rpc.Server(rpcUrl, { allowHttp: false })
	const account = await server.getAccount(keypair.publicKey())
	const contract = new Contract(contractId)

	const op = contract.call(
		"pay_shift",
		nativeToScVal(shiftId, { type: "string" }),
		Address.fromString(employer).toScVal(),
		Address.fromString(worker).toScVal(),
		Address.fromString(tokenId).toScVal(),
		nativeToScVal(amount, { type: "i128" }),
	)

	const built = new TransactionBuilder(account, {
		fee: BASE_FEE,
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(op)
		.setTimeout(60)
		.build()

	const prepared = await server.prepareTransaction(built)
	prepared.sign(keypair)

	const send = await server.sendTransaction(prepared)
	if (send.status === "ERROR") {
		const err = new Error("Failed to submit Testnet transaction")
		err.detail = send
		throw err
	}

	const hash = send.hash
	await waitForTx(server, hash)

	return {
		ok: true,
		shiftId,
		amountStroops: amount.toString(),
		amountXlm: "1",
		employer,
		worker,
		contractId,
		tokenId,
		transactionHash: hash,
		explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}`,
		timestamp: new Date().toISOString(),
	}
}

async function handler(req, res) {
	if (req.method === "OPTIONS") {
		json(res, 204, {})
		return
	}
	if (req.method !== "POST") {
		json(res, 405, { ok: false, error: "Method not allowed" })
		return
	}

	try {
		let body = req.body
		if (typeof body === "string") {
			body = body ? JSON.parse(body) : {}
		} else if (!body || typeof body !== "object") {
			body = {}
		}
		const shiftId = String(body.shiftId || "FW-120926-001")
		const payment = await payShift(shiftId)
		json(res, 200, payment)
	} catch (e) {
		const message = e?.message || String(e)
		const already =
			message.includes("Error(Contract, #1)") ||
			message.includes("AlreadyPaid") ||
			JSON.stringify(e?.detail || {}).includes("#1")
		json(res, 500, {
			ok: false,
			error: already
				? "This shift was already paid on-chain (duplicate protection)."
				: message,
		})
	}
}

module.exports = handler
module.exports.config = { maxDuration: 60 }
