// controllers/customerController.js
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js"; // You'll need to create this

// ── Response helpers ──────────────────────────────────────────────────────────
const ok = (res, data, msg = "Success") =>
  res.json({ success: true, message: msg, data });
const err = (res, msg, status = 500) =>
  res.status(status).json({ success: false, message: msg, data: null });

// ── GET ALL ───────────────────────────────────────────────────────────────────
export const getAll = async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = {};
    
    // Filter by type (supplier, credit, walkin, wholesale, etc.)
    if (type) filter.type = type;
    
    // Search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { area: { $regex: search, $options: "i" } },
      ];
    }
    
    const customers = await Customer.find(filter).sort({ name: 1 });
    console.log(`✅ GET customers — found ${customers.length} (type: ${type || 'all'})`);
    ok(res, customers);
  } catch (e) {
    console.error("❌ GET customers error:", e.message);
    err(res, e.message);
  }
};

// ── GET ONE ───────────────────────────────────────────────────────────────────
export const getOne = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      console.warn("⚠️ Customer not found:", req.params.id);
      return err(res, "Customer not found", 404);
    }
    console.log("✅ GET customer:", customer.name);
    ok(res, customer);
  } catch (e) {
    console.error("❌ GET one customer error:", e.message);
    err(res, e.message);
  }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const create = async (req, res) => {
  try {
    console.log("📥 CREATE customer payload:", JSON.stringify(req.body, null, 2));
    
    const customer = new Customer(req.body);
    
    // Set initial balance based on opening balance
    customer.currentBalance = customer.openingBalance || 0;
    
    await customer.save();
    console.log("✅ Customer created:", customer.name, "| Code:", customer.code, "| Type:", customer.type);
    ok(res, customer, "Customer created");
  } catch (e) {
    console.error("❌ CREATE customer error:", e.message);
    if (e.code === 11000) return err(res, "Customer code already exists", 400);
    err(res, e.message);
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
export const update = async (req, res) => {
  try {
    console.log("📝 UPDATE customer id:", req.params.id);
    
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      console.warn("⚠️ Customer not found for update:", req.params.id);
      return err(res, "Customer not found", 404);
    }
    
    console.log("✅ Customer updated:", customer.name);
    ok(res, customer, "Customer updated");
  } catch (e) {
    console.error("❌ UPDATE customer error:", e.message);
    err(res, e.message);
  }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
export const remove = async (req, res) => {
  try {
    console.log("🗑 DELETE customer id:", req.params.id);
    
    // Check if supplier has any purchases
    const hasPurchases = await Purchase.exists({ supplierId: req.params.id });
    if (hasPurchases) {
      return err(res, "Cannot delete supplier with purchase history", 400);
    }
    
    const customer = await Customer.findByIdAndDelete(req.params.id);
    
    if (!customer) {
      console.warn("⚠️ Customer not found for delete:", req.params.id);
      return err(res, "Customer not found", 404);
    }
    
    console.log("✅ Customer deleted:", customer.name);
    ok(res, customer, "Customer deleted");
  } catch (e) {
    console.error("❌ DELETE customer error:", e.message);
    err(res, e.message);
  }
};

// ── SALE HISTORY (for credit customers) ──────────────────────────────────────
export const getSaleHistory = async (req, res) => {
  try {
    const { from, to, saleType } = req.query;
    const filter = { customerId: req.params.id };
    
    if (saleType) filter.saleType = saleType;
    
    if (from || to) {
      filter.invoiceDate = {};
      if (from) filter.invoiceDate.$gte = from;
      if (to) filter.invoiceDate.$lte = to;
    }
    
    const sales = await Sale.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .lean();
    
    console.log(`✅ Sale history for ${req.params.id} — ${sales.length} records`);
    ok(res, sales);
  } catch (e) {
    console.error("❌ GET sale history error:", e.message);
    err(res, e.message);
  }
};

// ── PURCHASE HISTORY (for suppliers) ─────────────────────────────────────────
export const getPurchaseHistory = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { supplierId: req.params.id };
    
    if (from || to) {
      filter.purchaseDate = {};
      if (from) filter.purchaseDate.$gte = from;
      if (to) filter.purchaseDate.$lte = to;
    }
    
    const purchases = await Purchase.find(filter)
      .sort({ purchaseDate: -1, createdAt: -1 })
      .lean();
    
    console.log(`✅ Purchase history for supplier ${req.params.id} — ${purchases.length} records`);
    ok(res, purchases);
  } catch (e) {
    console.error("❌ GET purchase history error:", e.message);
    err(res, e.message);
  }
};

// ── RECALC BALANCE (called from sale/purchase controllers) ───────────────────
export const recalcBalance = async (customerId) => {
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return;
    
    let totalSales = 0;
    let totalPaid = 0;
    let totalReturns = 0;
    let totalPurchases = 0;
    let totalPurchasePaid = 0;
    
    // For credit customers (type = credit)
    if (customer.type === "credit") {
      const sales = await Sale.find({ customerId, saleType: "sale" }).lean();
      const returns = await Sale.find({ customerId, saleType: "return" }).lean();
      
      totalSales = sales.reduce((s, x) => s + (x.netTotal || 0), 0);
      totalPaid = sales.reduce((s, x) => s + (x.paidAmount || 0), 0);
      totalReturns = returns.reduce((s, x) => s + (x.netTotal || 0), 0);
      
      customer.currentBalance =
        (customer.openingBalance || 0) + totalSales - totalPaid - totalReturns;
    }
    
    // For suppliers (type = supplier)
    if (customer.type === "supplier") {
      const purchases = await Purchase.find({ supplierId: customerId }).lean();
      totalPurchases = purchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
      totalPurchasePaid = purchases.reduce((s, x) => s + (x.paidAmount || 0), 0);
      
      // For suppliers: positive balance means we owe them
      customer.currentBalance =
        (customer.openingBalance || 0) + totalPurchases - totalPurchasePaid;
    }
    
    await customer.save();
    console.log(`🔄 Balance recalculated for ${customer.name}: ${customer.currentBalance} (${customer.type})`);
  } catch (e) {
    console.error("❌ recalcBalance error:", e.message);
  }
};

// ── SUPPLIER SPECIFIC ENDPOINTS ──────────────────────────────────────────────
export const getSuppliers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { type: "supplier" };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    
    const suppliers = await Customer.find(filter).sort({ name: 1 });
    console.log(`✅ GET suppliers — found ${suppliers.length}`);
    ok(res, suppliers);
  } catch (e) {
    console.error("❌ GET suppliers error:", e.message);
    err(res, e.message);
  }
};

export const getSupplierPayables = async (req, res) => {
  try {
    const suppliers = await Customer.find(
      { type: "supplier", currentBalance: { $gt: 0 } },
      "name code currentBalance phone contactPerson"
    ).sort({ currentBalance: -1 });
    
    const totalPayable = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);
    
    ok(res, {
      suppliers,
      totalPayable,
      count: suppliers.length
    });
  } catch (e) {
    console.error("❌ GET supplier payables error:", e.message);
    err(res, e.message);
  }
};