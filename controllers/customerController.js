// controllers/customerController.js
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";

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
    
    if (type) filter.type = type;
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { area: { $regex: search, $options: "i" } },
      ];
    }
    
    const customers = await Customer.find(filter).sort({ name: 1 });
    console.log(`✅ GET customers — found ${customers.length}`);
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
      return err(res, "Customer not found", 404);
    }
    ok(res, customer);
  } catch (e) {
    console.error("❌ GET one customer error:", e.message);
    err(res, e.message);
  }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const create = async (req, res) => {
  try {
    const customer = new Customer(req.body);
    customer.currentBalance = customer.openingBalance || 0;
    await customer.save();
    console.log("✅ Customer created:", customer.name);
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
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      return err(res, "Customer not found", 404);
    }
    
    ok(res, customer, "Customer updated");
  } catch (e) {
    console.error("❌ UPDATE customer error:", e.message);
    err(res, e.message);
  }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
export const remove = async (req, res) => {
  try {
    const hasPurchases = await Purchase.exists({ supplierId: req.params.id });
    if (hasPurchases) {
      return err(res, "Cannot delete supplier with purchase history", 400);
    }
    
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return err(res, "Customer not found", 404);
    }
    
    ok(res, customer, "Customer deleted");
  } catch (e) {
    console.error("❌ DELETE customer error:", e.message);
    err(res, e.message);
  }
};

// ── SALE HISTORY ──────────────────────────────────────────────────────────────
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
    
    ok(res, sales);
  } catch (e) {
    console.error("❌ GET sale history error:", e.message);
    err(res, e.message);
  }
};

// ── PURCHASE HISTORY ──────────────────────────────────────────────────────────
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
    
    ok(res, purchases);
  } catch (e) {
    console.error("❌ GET purchase history error:", e.message);
    err(res, e.message);
  }
};

// ── RECALC BALANCE ────────────────────────────────────────────────────────────
export const recalcBalance = async (customerId) => {
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return;
    
    let totalSales = 0;
    let totalPaid = 0;
    let totalReturns = 0;
    let totalPurchases = 0;
    let totalPurchasePaid = 0;
    
    if (customer.type === "credit") {
      const sales = await Sale.find({ customerId, saleType: "sale" }).lean();
      const returns = await Sale.find({ customerId, saleType: "return" }).lean();
      
      totalSales = sales.reduce((s, x) => s + (x.netTotal || 0), 0);
      totalPaid = sales.reduce((s, x) => s + (x.paidAmount || 0), 0);
      totalReturns = returns.reduce((s, x) => s + (x.netTotal || 0), 0);
      
      customer.currentBalance =
        (customer.openingBalance || 0) + totalSales - totalPaid - totalReturns;
    }
    
    if (customer.type === "supplier") {
      const purchases = await Purchase.find({ supplierId: customerId }).lean();
      totalPurchases = purchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
      totalPurchasePaid = purchases.reduce((s, x) => s + (x.paidAmount || 0), 0);
      
      customer.currentBalance =
        (customer.openingBalance || 0) + totalPurchases - totalPurchasePaid;
    }
    
    await customer.save();
    console.log(`🔄 Balance recalculated for ${customer.name}: ${customer.currentBalance}`);
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

// ── UPDATE CUSTOMER BALANCE ───────────────────────────────────────────────────
export const updateCustomerBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, operation } = req.body;
    
    console.log("========== BALANCE UPDATE API ==========");
    console.log("Customer ID:", id);
    console.log("Amount:", amount);
    console.log("Operation:", operation);
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    
    if (!operation || (operation !== "add" && operation !== "subtract")) {
      return res.status(400).json({ success: false, message: "Invalid operation" });
    }
    
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    
    const oldBalance = customer.currentBalance || 0;
    let newBalance = operation === "subtract" ? oldBalance - amount : oldBalance + amount;
    
    customer.currentBalance = newBalance;
    await customer.save();
    
    console.log(`✅ Balance: ${oldBalance} -> ${newBalance}`);
    
    res.json({ 
      success: true, 
      data: { 
        currentBalance: newBalance,
        oldBalance: oldBalance,
        deducted: amount
      }
    });
  } catch (error) {
    console.error("Balance update error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};