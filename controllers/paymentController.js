// controllers/paymentController.js
import Payment from "../models/Payment.js";
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";

const ok = (res, data, msg = "Success") =>
  res.json({ success: true, message: msg, data });
const err = (res, msg, status = 500) =>
  res.status(status).json({ success: false, message: msg, data: null });

// ── CREATE PAYMENT ─────────────────────────────────────────────────────────
export const createPayment = async (req, res) => {
  try {
    const {
      customerId,
      saleId,
      invoiceNo,
      amount,
      paymentDate,
      paymentMode,
      remarks,
    } = req.body;

    if (!customerId || !amount || Number(amount) <= 0)
      return err(res, "customerId and amount are required", 400);

    // 1. Save payment record
    const payment = new Payment({
      customerId,
      saleId: saleId || null,
      invoiceNo: invoiceNo || "",
      amount: Number(amount),
      paymentDate: paymentDate || new Date().toISOString().split("T")[0],
      paymentMode: paymentMode || "Cash",
      remarks: remarks || "",
    });
    await payment.save();

    // 2. Update sale balance if saleId provided
    if (saleId) {
      const sale = await Sale.findById(saleId);
      if (sale) {
        const prevPayments = await Payment.find({
          saleId,
          _id: { $ne: payment._id },
        });
        const totalPaidLater = prevPayments.reduce(
          (s, p) => s + (p.amount || 0),
          0,
        );
        // Update sale's balance
        sale.balance = Math.max(0, (sale.balance || 0) - Number(amount));
        await sale.save();
        console.log(
          `✅ Sale ${sale.invoiceNo} balance updated: ${sale.balance}`,
        );
      }
    }

    // 3. Recalculate customer currentBalance
    await recalcCustomerBalance(customerId);

    console.log(
      `✅ Payment created: ${payment._id} | Amount: ${amount} | Customer: ${customerId}`,
    );
    ok(res, payment, "Payment recorded");
  } catch (e) {
    console.error("❌ CREATE payment error:", e.message);
    err(res, e.message);
  }
};

// ── GET PAYMENTS BY CUSTOMER ───────────────────────────────────────────────
export const getByCustomer = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { customerId: req.params.customerId };
    if (from || to) {
      filter.paymentDate = {};
      if (from) filter.paymentDate.$gte = from;
      if (to) filter.paymentDate.$lte = to;
    }
    const payments = await Payment.find(filter).sort({
      paymentDate: -1,
      createdAt: -1,
    });
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    console.log(
      `✅ GET payments for customer ${req.params.customerId} — ${payments.length} records`,
    );
    ok(res, { payments, total });
  } catch (e) {
    console.error("❌ GET payments error:", e.message);
    err(res, e.message);
  }
};

// ── GET PAYMENTS BY SALE ───────────────────────────────────────────────────
export const getBySale = async (req, res) => {
  try {
    const payments = await Payment.find({ saleId: req.params.saleId }).sort({
      createdAt: -1,
    });
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    console.log(
      `✅ GET payments for sale ${req.params.saleId} — ${payments.length} records`,
    );
    ok(res, { payments, total });
  } catch (e) {
    console.error("❌ GET payments by sale error:", e.message);
    err(res, e.message);
  }
};

// ── GET ALL PAYMENTS (with optional filters) ───────────────────────────────
export const getAll = async (req, res) => {
  try {
    const { customerId, saleId, from, to, limit = 100 } = req.query;
    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (saleId) filter.saleId = saleId;
    if (from || to) {
      filter.paymentDate = {};
      if (from) filter.paymentDate.$gte = from;
      if (to) filter.paymentDate.$lte = to;
    }
    const payments = await Payment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(Number(limit));
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    ok(res, { payments, total });
  } catch (e) {
    console.error("❌ GET all payments error:", e.message);
    err(res, e.message);
  }
};

// ── DELETE PAYMENT ─────────────────────────────────────────────────────────
export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return err(res, "Payment not found", 404);
    // Recalculate customer balance after deletion
    await recalcCustomerBalance(payment.customerId);
    ok(res, payment, "Payment deleted");
  } catch (e) {
    console.error("❌ DELETE payment error:", e.message);
    err(res, e.message);
  }
};

// ── HELPER: Recalculate customer balance ───────────────────────────────────
async function recalcCustomerBalance(customerId) {
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return;

    const sales = await Sale.find({ customerId, saleType: "sale" }).lean();
    const returns = await Sale.find({ customerId, saleType: "return" }).lean();
    const payments = await Payment.find({ customerId }).lean();

    const totalSales = sales.reduce((s, x) => s + (x.netTotal || 0), 0);
    const totalReturns = returns.reduce((s, x) => s + (x.netTotal || 0), 0);
    const totalPaidSales = sales.reduce((s, x) => s + (x.paidAmount || 0), 0);
    const totalPayments = payments.reduce((s, x) => s + (x.amount || 0), 0);

    customer.currentBalance = Math.max(
      0,
      (customer.openingBalance || 0) +
        totalSales -
        totalReturns -
        totalPaidSales -
        totalPayments,
    );
    await customer.save();
    console.log(
      `🔄 Customer ${customer.name} balance: ${customer.currentBalance}`,
    );
  } catch (e) {
    console.error("❌ recalcCustomerBalance error:", e.message);
  }
}

export { recalcCustomerBalance };
