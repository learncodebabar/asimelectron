// controllers/saleController.js
import Sale from "../models/Sale.js";
import Customer from "../models/Customer.js";

// ── HELPER: next INV number for regular sale ──────────────────────────────
const getNextInvNum = async () => {
  const last = await Sale.findOne(
    { saleType: "sale" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } }
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const n = parseInt(last.invoiceNo.replace("INV-", ""), 10);
    if (!isNaN(n) && n > 0) num = n + 1;
  }

  while (await Sale.exists({ invoiceNo: `INV-${String(num).padStart(5, "0")}` })) {
    num++;
  }
  return num;
};

// ── HELPER: next PUR number for regular purchase ──────────────────────────
const getNextPurNum = async () => {
  const last = await Sale.findOne(
    { saleType: "purchase" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } }
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const n = parseInt(last.invoiceNo.replace("PUR-", ""), 10);
    if (!isNaN(n) && n > 0) num = n + 1;
  }

  while (await Sale.exists({ invoiceNo: `PUR-${String(num).padStart(5, "0")}` })) {
    num++;
  }
  return num;
};

// ── HELPER: next RAW-P number for raw purchase ────────────────────────────
const getNextRawPurNum = async () => {
  const last = await Sale.findOne(
    { saleType: "raw-purchase" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } }
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const match = last.invoiceNo.match(/RAW-P-(\d+)/);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > 0) num = n + 1;
    }
  }

  while (await Sale.exists({ invoiceNo: `RAW-P-${String(num).padStart(5, "0")}` })) {
    num++;
  }
  return num;
};

// ── HELPER: next RAW-S number for raw sale ────────────────────────────────
const getNextRawSaleNum = async () => {
  const last = await Sale.findOne(
    { saleType: "raw-sale" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } }
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const match = last.invoiceNo.match(/RAW-S-(\d+)/);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > 0) num = n + 1;
    }
  }

  while (await Sale.exists({ invoiceNo: `RAW-S-${String(num).padStart(5, "0")}` })) {
    num++;
  }
  return num;
};

// ── HELPER: next RTN number for return ────────────────────────────────────
const getNextRtnNum = async () => {
  const last = await Sale.findOne(
    { saleType: "return" },
    { invoiceNo: 1 },
    { sort: { createdAt: -1 } }
  ).lean();

  let num = 1;
  if (last?.invoiceNo) {
    const n = parseInt(last.invoiceNo.replace("RTN-", ""), 10);
    if (!isNaN(n) && n > 0) num = n + 1;
  }

  while (await Sale.exists({ invoiceNo: `RTN-${String(num).padStart(5, "0")}` })) {
    num++;
  }
  return num;
};

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
      invoiceNo,
    } = req.query;

    const filter = {};
    if (invoiceNo) filter.invoiceNo = invoiceNo;
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

// ── GET all raw purchases only ────────────────────────────────────────────
// ── GET all raw purchases only ────────────────────────────────────────────
export const getAllRawPurchases = async (req, res) => {
  try {
    const {
      customerId,
      dateFrom,
      dateTo,
      search,
      limit,
      invoiceNo,
    } = req.query;

    const filter = { saleType: "raw-purchase" };
    if (invoiceNo) filter.invoiceNo = invoiceNo;
    if (customerId) filter.customerId = customerId;

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

    console.log(`Found ${sales.length} raw purchase records`);
    res.json({ success: true, data: sales, count: sales.length });
  } catch (e) {
    console.error("Error in getAllRawPurchases:", e);
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
      "name phone code currentBalance"
    );
    if (!sale)
      return res.status(404).json({ success: false, message: "Sale not found" });
    res.json({ success: true, data: sale });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── GET next invoice number for regular sale ──────────────────────────────
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

// ── GET next purchase invoice number ──────────────────────────────────────
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

// ── GET next raw purchase invoice number ──────────────────────────────────
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

// ── GET next raw sale invoice number ──────────────────────────────────────
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

// ── GET next return number ────────────────────────────────────────────────
export const getNextReturnNo = async (req, res) => {
  try {
    const num = await getNextRtnNum();
    res.json({
      success: true,
      data: { returnNo: `RTN-${String(num).padStart(5, "0")}` },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── CREATE regular sale ───────────────────────────────────────────────────
export const createSale = async (req, res) => {
  try {
    const num = await getNextInvNum();
    const invoiceNo = `INV-${String(num).padStart(5, "0")}`;

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
      saleType: "sale",
    };

    const sale = await Sale.create(body);
    
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── CREATE regular purchase ───────────────────────────────────────────────
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
        $inc: { currentBalance: sale.balance }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// controllers/saleController.js
// In saleController.js, update the createRawPurchase function
export const createRawPurchase = async (req, res) => {
  try {
    const num = await getNextRawPurNum();
    const invoiceNo = `RAW-P-${String(num).padStart(5, "0")}`;

    console.log("========== CREATING RAW PURCHASE ==========");
    console.log("Customer ID from request:", req.body.customerId);
    console.log("Paid Amount:", req.body.paidAmount);

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || null,
      saleType: "raw-purchase",
    };

    // Create the sale
    const sale = await Sale.create(body);
    console.log("✅ Sale created:", sale.invoiceNo);

    // ✅ CHECK AND CREATE CUSTOMER IF MISSING
    if (sale.customerId) {
      let customer = await Customer.findById(sale.customerId);
      
      // If customer doesn't exist, create it automatically
      if (!customer) {
        console.log(`⚠️ Customer not found, creating new customer...`);
        
        // Generate a simple code
        const lastCustomer = await Customer.findOne({}, {}, { sort: { createdAt: -1 } });
        let nextCode = 1;
        if (lastCustomer?.code) {
          nextCode = parseInt(lastCustomer.code) + 1;
        }
        
        customer = new Customer({
          _id: sale.customerId, // Use the same ID from the sale
          name: sale.customerName,
          code: String(nextCode),
          type: "credit",
          currentBalance: sale.prevBalance || 0,
          openingBalance: sale.prevBalance || 0,
          openingBalanceType: "Debit",
          phone: sale.customerPhone || "",
        });
        
        await customer.save();
        console.log(`✅ Auto-created customer: ${customer.name} with ID: ${customer._id}`);
      }
      
      // Update balance
      if (sale.paidAmount > 0) {
        const oldBalance = customer.currentBalance || 0;
        const newBalance = oldBalance - sale.paidAmount;
        
        console.log(`Customer: ${customer.name}`);
        console.log(`Old balance: ${oldBalance}`);
        console.log(`Amount to deduct: ${sale.paidAmount}`);
        console.log(`New balance: ${newBalance}`);
        
        customer.currentBalance = newBalance;
        await customer.save();
        
        console.log(`✅ BALANCE UPDATED SUCCESSFULLY!`);
        
        // Update the sale document with actual previous balance
        sale.prevBalance = oldBalance;
        sale.balance = newBalance;
        await sale.save();
      }
    }

    console.log("========== RAW PURCHASE COMPLETE ==========\n");
    res.status(201).json({ success: true, data: sale });
    
  } catch (e) {
    console.error("❌ Create raw purchase error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};
// ── CREATE raw sale (customer receives raw material) ──────────────────────
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
        $inc: { currentBalance: sale.balance }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── CREATE sale return ────────────────────────────────────────────────────
export const createSaleReturn = async (req, res) => {
  try {
    const num = await getNextRtnNum();
    const returnNo = `RTN-${String(num).padStart(5, "0")}`;

    const body = {
      ...req.body,
      invoiceNo: returnNo,
      returnNo,
      invoiceDate: req.body.returnDate,
      saleType: "return",
    };

    const sale = await Sale.create(body);
    
    if (sale.customerId && sale.paidAmount > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: -sale.paidAmount }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── UPDATE sale (handles all types) ───────────────────────────────────────
export const updateSale = async (req, res) => {
  try {
    const oldSale = await Sale.findById(req.params.id);
    if (!oldSale)
      return res.status(404).json({ success: false, message: "Not found" });

    const { invoiceNo, returnNo, saleType, ...updateData } = req.body;

    // Reverse old balance change
    if (oldSale.customerId) {
      if (oldSale.saleType === "raw-purchase") {
        if (oldSale.paidAmount > 0) {
          await Customer.findByIdAndUpdate(oldSale.customerId, {
            $inc: { currentBalance: oldSale.paidAmount }
          });
        }
      } else if (oldSale.saleType === "raw-sale") {
        if (oldSale.balance > 0) {
          await Customer.findByIdAndUpdate(oldSale.customerId, {
            $inc: { currentBalance: -oldSale.balance }
          });
        }
      } else if (oldSale.saleType === "return") {
        if (oldSale.paidAmount > 0) {
          await Customer.findByIdAndUpdate(oldSale.customerId, {
            $inc: { currentBalance: oldSale.paidAmount }
          });
        }
      } else if (oldSale.balance > 0) {
        await Customer.findByIdAndUpdate(oldSale.customerId, {
          $inc: { currentBalance: -oldSale.balance }
        });
      }
    }

    const sale = await Sale.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    // Apply new balance change
    if (sale.customerId) {
      if (sale.saleType === "raw-purchase") {
        if (sale.paidAmount > 0) {
          await Customer.findByIdAndUpdate(sale.customerId, {
            $inc: { currentBalance: -sale.paidAmount }
          });
        }
      } else if (sale.saleType === "raw-sale") {
        if (sale.balance > 0) {
          await Customer.findByIdAndUpdate(sale.customerId, {
            $inc: { currentBalance: sale.balance }
          });
        }
      } else if (sale.saleType === "return") {
        if (sale.paidAmount > 0) {
          await Customer.findByIdAndUpdate(sale.customerId, {
            $inc: { currentBalance: -sale.paidAmount }
          });
        }
      } else if (sale.balance > 0) {
        await Customer.findByIdAndUpdate(sale.customerId, {
          $inc: { currentBalance: sale.balance }
        });
      }
    }

    res.json({ success: true, data: sale });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ── DELETE sale (handles all types) ───────────────────────────────────────
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale)
      return res.status(404).json({ success: false, message: "Not found" });
    
    // Reverse the balance change before deleting
    if (sale.customerId) {
      if (sale.saleType === "raw-purchase") {
        if (sale.paidAmount > 0) {
          await Customer.findByIdAndUpdate(sale.customerId, {
            $inc: { currentBalance: sale.paidAmount }
          });
        }
      } else if (sale.saleType === "raw-sale") {
        if (sale.balance > 0) {
          await Customer.findByIdAndUpdate(sale.customerId, {
            $inc: { currentBalance: -sale.balance }
          });
        }
      } else if (sale.saleType === "return") {
        if (sale.paidAmount > 0) {
          await Customer.findByIdAndUpdate(sale.customerId, {
            $inc: { currentBalance: sale.paidAmount }
          });
        }
      } else if (sale.balance > 0) {
        await Customer.findByIdAndUpdate(sale.customerId, {
          $inc: { currentBalance: -sale.balance }
        });
      }
    }
    
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};