#!/usr/bin/env node
/**
 * End-to-end check for the POS drop-in sale (Jalur A).
 *
 * It replays exactly what the front desk does on the EDC rail — nothing is
 * simulated and no endpoint is invented:
 *
 *   1. POST /api/v1/auth/login                      → bearer token
 *   2. GET  /api/v1/membership-plans                → find the drop-in product
 *   3. GET  /api/v1/members/search                  → the test customer
 *   4. GET  /api/member-drop-in-passes/member/{id}  → snapshot passes BEFORE
 *   5. POST /api/v1/payments                        → paymentCategory 3 or 4
 *   6. PUT  /api/v1/payments/{id}                   → mark Paid (EDC reference)
 *   7. GET  /api/v1/payments/{id}                   → backend-confirmed status
 *   8. GET  /api/member-drop-in-passes/member/{id}  → did a NEW pass appear?
 *
 * Step 8 is the whole point: it answers the one thing that cannot be read off
 * the frontend — whether the backend's activation handler issues a
 * `MemberDropInPass` for payment categories 3/4, or only for Membership/PT.
 *
 * WRITES REAL DATA. It creates a payment record and marks it Paid, which is
 * what makes the backend act. Run it against staging. `--yes` is required.
 *
 * Usage:
 *   node scripts/test-drop-in-flow.mjs \
 *     --base https://staging-api.sweatboxfnp.com \
 *     --email admin@sweatbox.com --password '...' \
 *     --member 'nama atau email customer test' \
 *     [--plan <membershipPlanId>] [--create-plan] [--branch <branchId>] \
 *     [--kind pass|single] --yes
 *
 * Credentials can also come from the environment: SWEATBOX_API_BASE_URL,
 * SWEATBOX_TEST_EMAIL, SWEATBOX_TEST_PASSWORD.
 */

const PaymentCategory = { Membership: 1, PTPackage: 2, DropInSingle: 3, DropInPass: 4 };
const PaymentMethod = { Cash: 0, BankTransfer: 1, QRIS: 2, CreditCard: 3 };
const PaymentProvider = { Manual: 0, Midtrans: 1, Xendit: 2, AsteriPay: 3 };
const PaymentStatus = { Pending: 0, Paid: 1, Failed: 2, Expired: 3, Refunded: 4, Cancelled: 5 };

const PASS_CHECK_ATTEMPTS = 6;
const PASS_CHECK_INTERVAL_MS = 2000;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const BASE = (args.base || process.env.SWEATBOX_API_BASE_URL || "").replace(/\/$/, "");
const EMAIL = args.email || process.env.SWEATBOX_TEST_EMAIL;
const PASSWORD = args.password || process.env.SWEATBOX_TEST_PASSWORD;

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

if (!BASE) fail("--base <API base url> wajib diisi (jangan pakai URL production).");
if (!EMAIL || !PASSWORD) fail("--email dan --password wajib diisi.");
if (!args.member) fail("--member <keyword pencarian customer test> wajib diisi.");
if (!args.yes) {
  fail(
    "Script ini MENULIS data (payment dibuat lalu ditandai Paid). Tambahkan --yes " +
      "kalau target di atas memang environment testing."
  );
}

let token = "";

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: res.ok, status: res.status, data };
}

/** Paged or plain array — the backend answers both shapes. */
function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
  }
  return [];
}

/** Same rule the POS uses, so the script tests what staff will actually sell. */
function isDropInPlan(plan) {
  return (plan?.planCategory ?? "").toLowerCase().replace(/[^a-z]/g, "").includes("dropin");
}

function dropInKindOf(plan) {
  const category = (plan?.planCategory ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (category.includes("single")) return "single";
  if (category.includes("pass")) return "pass";
  return Number(plan?.credits ?? 0) > 1 ? "pass" : "single";
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const step = (n, label) => console.log(`\n[${n}] ${label}`);

async function main() {
  console.log(`Target   : ${BASE}`);
  console.log(`Operator : ${EMAIL}`);

  // 1 — login
  step(1, "Login");
  const login = await call("POST", "/api/v1/auth/login", { email: EMAIL, password: PASSWORD });
  if (!login.ok || !login.data?.token) {
    fail(`Login gagal (${login.status}): ${JSON.stringify(login.data)}`);
  }
  token = login.data.token;
  console.log(`    ✓ ${login.data.fullName ?? EMAIL} · role ${login.data.role ?? "-"}`);

  // 2 — the drop-in product
  step(2, "Cari membership plan bertanda Drop In");
  const plansRes = await call("GET", "/api/v1/membership-plans?page=1&pageSize=200");
  if (!plansRes.ok) fail(`Gagal memuat membership plan (${plansRes.status})`);
  const plans = toList(plansRes.data);
  let plan = args.plan
    ? plans.find((p) => p.id === args.plan)
    : plans.filter((p) => isDropInPlan(p) && p.isActive !== false)[0];

  if (!plan && args["create-plan"]) {
    const branchesRes = await call("GET", "/api/v1/branches");
    const branches = toList(branchesRes.data);
    const branchId = args.branch || branches[0]?.id;
    if (!branchId) fail("Tidak ada branch untuk membuat test plan.");
    console.log("    · Tidak ada plan drop-in — membuat plan test baru");
    const created = await call("POST", "/api/v1/membership-plans", {
      branchId,
      planName: `TEST Drop In Pass ${new Date().toISOString().slice(0, 10)}`,
      description: "Plan test otomatis untuk verifikasi drop-in POS. Hapus setelah tes.",
      price: 1000,
      credits: 3,
      validityDays: 30,
      isUnlimitedClasses: false,
      isPtIncluded: false,
      ptSessions: 0,
      isPopular: false,
      planCategory: "Drop In Pass",
      registrationFee: 0,
      allowMultiBranchAccess: false,
      isActive: true,
    });
    if (!created.ok) fail(`Gagal membuat test plan (${created.status}): ${JSON.stringify(created.data)}`);
    const refreshed = await call("GET", "/api/v1/membership-plans?page=1&pageSize=200");
    plan = toList(refreshed.data).filter(isDropInPlan).slice(-1)[0];
  }

  if (!plan) {
    fail(
      "Tidak ketemu membership plan dengan planCategory mengandung \"Drop In\". " +
        "Buat dulu lewat menu Membership Plans (Plan Category: \"Drop In Pass\", " +
        "Credits = jumlah kunjungan), atau jalankan ulang dengan --create-plan."
    );
  }

  const kind = args.kind || dropInKindOf(plan);
  const category = kind === "pass" ? PaymentCategory.DropInPass : PaymentCategory.DropInSingle;
  console.log(
    `    ✓ ${plan.planName} · category "${plan.planCategory}" · ${plan.credits} credit · ` +
      `Rp ${plan.price ?? 0} → kirim sebagai ${kind === "pass" ? "DropInPass (4)" : "DropInSingle (3)"}`
  );

  // 3 — the customer
  step(3, "Cari customer test");
  const membersRes = await call(
    "GET",
    `/api/v1/members/search?keyword=${encodeURIComponent(args.member)}&page=1&pageSize=20`
  );
  if (!membersRes.ok) fail(`Pencarian member gagal (${membersRes.status})`);
  const member = toList(membersRes.data)[0];
  if (!member) fail(`Customer "${args.member}" tidak ditemukan.`);
  console.log(
    `    ✓ ${member.fullName ?? member.memberCode ?? member.id} · id ${member.id} · ` +
      `drop-in visits sekarang: ${member.remainingDropInVisits ?? 0}`
  );

  // 4 — snapshot before
  step(4, "Snapshot drop-in pass sebelum transaksi");
  const beforeRes = await call("GET", `/api/member-drop-in-passes/member/${member.id}`);
  if (!beforeRes.ok) {
    fail(
      `Gagal membaca drop-in pass (${beforeRes.status}). Tanpa snapshot, hasil tes tidak ` +
        `bisa dipercaya. Response: ${JSON.stringify(beforeRes.data)}`
    );
  }
  const before = toList(beforeRes.data);
  const beforeIds = new Set(before.map((p) => p.id));
  console.log(`    ✓ ${before.length} pass sebelum transaksi`);

  // 5 — create the payment, exactly as the POS does
  step(5, "Buat payment (rail EDC, provider Manual)");
  const createBody = {
    memberId: member.id,
    membershipPlanId: plan.id,
    paymentCategory: category,
    paymentMethod: PaymentMethod.CreditCard,
    paymentProvider: PaymentProvider.Manual,
    branchId: plan.branchId || args.branch || undefined,
    notes: `TEST Front Desk · drop-in verification · ${new Date().toISOString()}`,
  };
  const createdPayment = await call("POST", "/api/v1/payments", createBody);
  if (!createdPayment.ok || !createdPayment.data?.id) {
    fail(
      `Create payment gagal (${createdPayment.status}): ${JSON.stringify(createdPayment.data)}\n` +
        `    → Kalau errornya soal paymentCategory, berarti backend belum menerima kategori ${category}.`
    );
  }
  const payment = createdPayment.data;
  console.log(
    `    ✓ payment ${payment.id} · invoice ${payment.invoiceNo ?? "-"} · ` +
      `Rp ${payment.finalAmount ?? payment.amount ?? 0}`
  );

  // 6 — mark it Paid the way the EDC confirm does
  step(6, "Tandai Paid (seperti konfirmasi struk EDC)");
  const reference = `TEST-DROPIN-${Date.now()}`;
  const paid = await call("PUT", `/api/v1/payments/${payment.id}`, {
    membershipPlanId: payment.membershipPlanId ?? plan.id,
    amount: payment.amount ?? plan.price ?? 0,
    discount: payment.discount ?? 0,
    tax: payment.tax ?? 0,
    paymentMethod: PaymentMethod.CreditCard,
    paymentStatus: PaymentStatus.Paid,
    providerTransactionId: reference,
    notes: `${createBody.notes} · ref ${reference}`,
  });
  if (!paid.ok) fail(`Update payment gagal (${paid.status}): ${JSON.stringify(paid.data)}`);
  console.log(`    ✓ ref ${reference}`);

  // 7 — trust only what the backend reports
  step(7, "Baca ulang status payment dari backend");
  const reread = await call("GET", `/api/v1/payments/${payment.id}`);
  if (!reread.ok) fail(`Gagal membaca payment (${reread.status})`);
  if (reread.data?.paymentStatus !== PaymentStatus.Paid) {
    fail(
      `Backend belum menandai payment ini Paid (status ${reread.data?.paymentStatus}). ` +
        `Aktivasi drop-in tidak akan jalan sebelum ini beres.`
    );
  }
  console.log(`    ✓ status Paid · paidAt ${reread.data?.paidAt ?? "-"}`);

  // 8 — the actual question
  step(8, "Cek apakah backend menerbitkan drop-in pass baru");
  let issued = null;
  for (let attempt = 1; attempt <= PASS_CHECK_ATTEMPTS && !issued; attempt++) {
    const afterRes = await call("GET", `/api/member-drop-in-passes/member/${member.id}`);
    const after = toList(afterRes.data);
    issued = after.find((p) => !beforeIds.has(p.id)) ?? null;
    console.log(
      `    percobaan ${attempt}/${PASS_CHECK_ATTEMPTS}: ${after.length} pass ` +
        (issued ? "→ pass baru ditemukan" : "→ belum ada pass baru")
    );
    if (!issued && attempt < PASS_CHECK_ATTEMPTS) await delay(PASS_CHECK_INTERVAL_MS);
  }

  const memberAfter = await call("GET", `/api/v1/members/${member.id}`);
  const visitsAfter = memberAfter.data?.remainingDropInVisits ?? 0;

  console.log("\n────────────────────────────────────────────");
  if (issued) {
    console.log("✓ LULUS — backend menerbitkan drop-in pass untuk kategori ini.");
    console.log(`  pass id        : ${issued.id}`);
    console.log(`  branch         : ${issued.branch?.branchName ?? issued.branchId}`);
    console.log(`  total visits   : ${issued.totalVisits}`);
    console.log(`  sisa visits    : ${issued.remainingVisits}`);
    console.log(`  berlaku sampai : ${issued.expiredAt}`);
    console.log(`  aktif          : ${issued.isActive}`);
    console.log(`  member.remainingDropInVisits: ${member.remainingDropInVisits ?? 0} → ${visitsAfter}`);
    console.log("\n  Drop in siap dijual dari POS.");
  } else {
    console.log("✗ TIDAK LULUS — payment Paid, tapi tidak ada drop-in pass baru.");
    console.log(`  payment id : ${payment.id} (Paid, perlu dibereskan/di-refund manual)`);
    console.log(`  member     : ${member.id}`);
    console.log(
      "\n  Artinya handler aktivasi backend belum menangani PaymentCategory " +
        `${category}. Ini bagian yang butuh perubahan BE; POS sudah mengirim ` +
        "kategori yang benar dan akan menampilkan peringatan yang sama ke kasir."
    );
  }
  console.log("────────────────────────────────────────────");
  console.log(
    "\nBersihkan data tes: hapus payment di menu Payments" +
      (args["create-plan"] ? ", dan plan test di menu Membership Plans" : "") +
      "."
  );

  process.exit(issued ? 0 : 2);
}

main().catch((err) => fail(err?.stack || String(err)));
