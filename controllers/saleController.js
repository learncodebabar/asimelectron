// controllers/saleController.js
import Sale from "../models/Sale.js";
import Customer from "../models/Customer.js";

// ── GET all sales — full filter support ───────────────────────────────────
export const getAllSales = async (req, res) => {
  try {
    const {
      customerId,
      saleType,
      saleSource,
      paymentMode,
      dateFrom,
      dateTo,
      search,
      limit,
    } = req.query;

    const filter = {};
    if (req.query.invoiceNo) {
      filter.invoiceNo = req.query.invoiceNo;
    }
    if (customerId) filter.customerId = customerId;
    if (saleType) filter.saleType = saleType;
    if (saleSource) filter.saleSource = saleSource;
    if (paymentMode) filter.paymentMode = paymentMode;

    if (dateFrom || dateTo) {
      filter.invoiceDate = {};
      if (dateFrom) filter.invoiceDate.$gte = dateFrom;
      if (dateTo) filter.invoiceDate.$lte = dateTo;
    }

    if (search) {
      const r = new RegExp(search, "i");
      filter.$or = [
        { invoiceNo: r },
        { customerName: r },
        { customerPhone: r },
      ];
    }

    const sales = await Sale.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .limit(Number(limit) || 1000);

    res.json({ success: true, data: sales, count: sales.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── GET summary stats ─────────────────────────────────────────────────────
export const getSaleSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.invoiceDate = {};
      if (dateFrom) dateFilter.invoiceDate.$gte = dateFrom;
      if (dateTo) dateFilter.invoiceDate.$lte = dateTo;
    }

    const agg = (extra) =>
      Sale.aggregate([
        { $match: { ...dateFilter, saleType: "sale", ...extra } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$netTotal" },
            paid: { $sum: "$paidAmount" },
            balance: { $sum: "$balance" },
          },
        },
      ]);

    const [all, debit, credit, cash, returns] = await Promise.all([
      agg({}),
      agg({ saleSource: "debit" }),
      agg({ saleSource: "credit" }),
      agg({ saleSource: "cash" }),
      Sale.aggregate([
        { $match: { ...dateFilter, saleType: "return" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$netTotal" },
          },
        },
      ]),
    ]);

    const g = (a) => a[0] || { count: 0, total: 0, paid: 0, balance: 0 };
    res.json({
      success: true,
      data: {
        all: g(all),
        debit: g(debit),
        credit: g(credit),
        cash: g(cash),
        returns: g(returns),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── GET single sale ───────────────────────────────────────────────────────
export const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate(
      "customerId",
      "name phone code",
    );
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    res.json({ success: true, data: sale });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── HELPER: next INV number
const getNextInvNum = async () => {
  const last = await Sale.findOne(
    { saleType: "sale" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } },
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const n = parseInt(last.invoiceNo.replace("INV-", ""), 10);
    if (!isNaN(n) && n > 0) num = n + 1;
  }

  // ✅ Loop karo jab tak unique number na mile
  while (
    await Sale.exists({ invoiceNo: `INV-${String(num).padStart(5, "0")}` })
  ) {
    num++;
  }

  return num;
};

// ── GET next invoice number ───────────────────────────────────────────────
export const getNextInvoice = async (req, res) => {
  try {
    const num = await getNextInvNum();
    res.json({
      success: true,
      data: { invoiceNo: `INV-${String(num).padStart(5, "0")}` },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
// ── HELPER: next PUR number
const getNextPurNum = async () => {
  const last = await Sale.findOne(
    { saleType: "purchase" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } },
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const n = parseInt(last.invoiceNo.replace("PUR-", ""), 10);
    if (!isNaN(n) && n > 0) num = n + 1;
  }

  while (
    await Sale.exists({ invoiceNo: `PUR-${String(num).padStart(5, "0")}` })
  ) {
    num++;
  }

  return num;
};

// ── GET next purchase invoice number
export const getNextPurchaseInvoice = async (req, res) => {
  try {
    const num = await getNextPurNum();
    res.json({
      success: true,
      data: { invoiceNo: `PUR-${String(num).padStart(5, "0")}` },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── CREATE PURCHASE
export const createPurchase = async (req, res) => {
  try {
    const num = await getNextPurNum();
    const invoiceNo = `PUR-${String(num).padStart(5, "0")}`;

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
      saleType: "purchase",
    };

    const sale = await Sale.create(body);
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance },
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── POST create sale ──────────────────────────────────────────────────────
export const createSale = async (req, res) => {
  try {
    const num = await getNextInvNum();
    const prefix = req.body.invoicePrefix || "INV";
    const invoiceNo = `${prefix}-${String(num).padStart(5, "0")}`;

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
    };

    const sale = await Sale.create(body);
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance },
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── PUT update sale ───────────────────────────────────────────────────────
export const updateSale = async (req, res) => {
  try {
    const oldSale = await Sale.findById(req.params.id);
    if (!oldSale)
      return res.status(404).json({ success: false, message: "Not found" });

    const { invoiceNo, returnNo, saleType, ...updateData } = req.body;

    if (oldSale.customerId) {
      await Customer.findByIdAndUpdate(oldSale.customerId, {
        $inc: { currentBalance: -(oldSale.balance || 0) },
      });
    }

    const sale = await Sale.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (sale.customerId) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance || 0 },
      });
    }

    res.json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};
// ── DELETE sale ───────────────────────────────────────────────────────────
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findByIdAndDelete(req.params.id);
    if (!sale)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── POST create sale return ───────────────────────────────────────────────
export const createSaleReturn = async (req, res) => {
  try {
    // Return number — sirf returns mein se last dhundo (sahi tha pehle se)
    const last = await Sale.findOne(
      { saleType: "return" },
      { invoiceNo: 1 },
      { sort: { createdAt: -1 } },
    ).lean();

    let num = 1;
    if (last?.invoiceNo) {
      const n = parseInt(last.invoiceNo.replace("RTN-", ""), 10);
      if (!isNaN(n) && n > 0) num = n + 1;
    }
    const returnNo = `RTN-${String(num).padStart(5, "0")}`;

    const sale = await Sale.create({
      ...req.body,
      invoiceNo: returnNo,
      returnNo,
      invoiceDate: req.body.returnDate,
      saleType: "return",
    });

    if (sale.customerId && sale.paidAmount > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: -sale.paidAmount },
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── HELPER: next RAW-P number
const getNextRawPurNum = async () => {
  const last = await Sale.findOne(
    { saleType: "raw-purchase" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } },
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const n = parseInt(last.invoiceNo.replace("RAW-P-", ""), 10);
    if (!isNaN(n) && n > 0) num = n + 1;
  }

  while (
    await Sale.exists({ invoiceNo: `RAW-P-${String(num).padStart(5, "0")}` })
  ) {
    num++;
  }
  return num;
};

// ── GET next raw purchase invoice
export const getNextRawPurchaseInvoice = async (req, res) => {
  try {
    const num = await getNextRawPurNum();
    res.json({
      success: true,
      data: { invoiceNo: `RAW-P-${String(num).padStart(5, "0")}` },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── CREATE RAW PURCHASE
export const createRawPurchase = async (req, res) => {
  try {
    const num = await getNextRawPurNum();
    const invoiceNo = `RAW-P-${String(num).padStart(5, "0")}`;

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
      saleType: "raw-purchase",
    };

    const sale = await Sale.create(body);
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance },
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── HELPER: next RAW-S number
const getNextRawSaleNum = async () => {
  const last = await Sale.findOne(
    { saleType: "raw-sale" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } },
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const n = parseInt(last.invoiceNo.replace("RAW-S-", ""), 10);
    if (!isNaN(n) && n > 0) num = n + 1;
  }

  while (
    await Sale.exists({ invoiceNo: `RAW-S-${String(num).padStart(5, "0")}` })
  ) {
    num++;
  }
  return num;
};

export const getNextRawSaleInvoice = async (req, res) => {
  try {
    const num = await getNextRawSaleNum();
    res.json({
      success: true,
      data: { invoiceNo: `RAW-S-${String(num).padStart(5, "0")}` },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createRawSale = async (req, res) => {
  try {
    const num = await getNextRawSaleNum();
    const invoiceNo = `RAW-S-${String(num).padStart(5, "0")}`;

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
      saleType: "raw-sale",
    };

    const sale = await Sale.create(body);
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance },
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};
