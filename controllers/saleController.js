// controllers/saleController.js - COMPLETE FIXED WITH STOCK MANAGEMENT

import Sale from "../models/Sale.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js"; // IMPORTANT: Must import Product model

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: Get current year-month code (YYMM) - Same as Frontend
═══════════════════════════════════════════════════════════════════════════ */
const getCurrentYearMonthCode = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}${month}`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   INVOICE NUMBER GENERATOR - Same as Frontend (YYMM + 4 digit sequence)
═══════════════════════════════════════════════════════════════════════════ */
const generateInvoiceNumber = async () => {
  const currentYearMonth = getCurrentYearMonthCode();
  let maxSeqForMonth = 0;
  
  // Find all sales with current year-month prefix (YYMMxxxx format)
  const sales = await Sale.find({ 
    invoiceNo: { $regex: `^${currentYearMonth}`, $options: 'i' } 
  });
  
  for (const sale of sales) {
    if (sale.invoiceNo && sale.invoiceNo.length === 8 && /^\d+$/.test(sale.invoiceNo)) {
      const seqNum = parseInt(sale.invoiceNo.slice(-4), 10);
      if (!isNaN(seqNum) && seqNum > maxSeqForMonth) {
        maxSeqForMonth = seqNum;
      }
    }
  }
  
  const nextSeq = maxSeqForMonth + 1;
  const formattedSeq = nextSeq.toString().padStart(4, '0');
  const newInvoiceNo = `${currentYearMonth}${formattedSeq}`;
  
  return newInvoiceNo;
};

/* ═══════════════════════════════════════════════════════════════════════════
   STOCK UPDATE HELPERS
═══════════════════════════════════════════════════════════════════════════ */

// Update single product stock
// Update single product stock
const updateProductStock = async (productId, uom, qty, isRestore = false) => {
  try {
    if (!productId) return false;
    
    const product = await Product.findById(productId);
    if (!product || !product.packingInfo) {
      console.log(`⚠️ Product not found or no packing info: ${productId}`);
      return false;
    }
    
    const packingIndex = product.packingInfo.findIndex(pk => pk.measurement === uom);
    if (packingIndex === -1) {
      console.log(`⚠️ Packing not found for ${uom} in product: ${productId}`);
      return false;
    }
    
    const currentStock = product.packingInfo[packingIndex].openingQty || 0;
    
    // isRestore = true → ADD stock (for returns)
    // isRestore = false → DEDUCT stock (for sales)
    let newStock;
    if (isRestore) {
      newStock = currentStock + qty;  // ADD back to stock
      console.log(`📦 RETURN: Adding ${qty} ${uom} to stock for ${product.code}`);
    } else {
      newStock = Math.max(0, currentStock - qty);  // DEDUCT from stock
      console.log(`📦 SALE: Deducting ${qty} ${uom} from stock for ${product.code}`);
    }
    
    product.packingInfo[packingIndex].openingQty = newStock;
    await product.save();
    
    console.log(`📦 Stock updated: ${product.code} - ${uom}: ${currentStock} → ${newStock}`);
    return true;
  } catch (error) {
    console.error("Failed to update stock:", error);
    return false;
  }
};
// Restore all items stock from a sale (for delete or edit)
const restoreSaleStock = async (sale) => {
  if (!sale.items || sale.items.length === 0) return;
  
  console.log(`🔄 Restoring stock for sale: ${sale.invoiceNo}`);
  for (const item of sale.items) {
    const uom = item.measurement || item.uom;
    const qty = item.qty || item.pcs;
    await updateProductStock(item.productId, uom, qty, true);
  }
  console.log(`✅ Stock restored for sale: ${sale.invoiceNo}`);
};

// Deduct all items stock for a sale (for new sale)
// Deduct all items stock for a sale (for new sale)
const deductSaleStock = async (sale) => {
  if (!sale.items || sale.items.length === 0) return;
  
  console.log(`📉 Deducting stock for sale: ${sale.invoiceNo}`);
  for (const item of sale.items) {
    const uom = item.measurement || item.uom;
    const qty = item.qty || item.pcs;
    // Make sure we're deducting the correct quantity
    console.log(`  - Deducting ${qty} ${uom} from product ${item.productId}`);
    await updateProductStock(item.productId, uom, qty, false);
  }
  console.log(`✅ Stock deducted for sale: ${sale.invoiceNo}`);
};

/* ═══════════════════════════════════════════════════════════════════════════
   GET all sales — full filter support
═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   GET all raw purchases only
═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   GET summary stats
═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   GET single sale
═══════════════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════════════
   GET next invoice numbers (YYMMXXXX format)
═══════════════════════════════════════════════════════════════════════════ */
export const getNextInvoice = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.json({ success: true, data: { invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getNextPurchaseInvoice = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.json({ success: true, data: { invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getNextRawPurchaseInvoice = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.json({ success: true, data: { invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getNextRawSaleInvoice = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.json({ success: true, data: { invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getNextReturnNo = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.json({ success: true, data: { returnNo: invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE regular sale (with STOCK DEDUCTION)
═══════════════════════════════════════════════════════════════════════════ */
export const createSale = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
      saleType: "sale",
    };

    const sale = await Sale.create(body);
    
    // DEDUCT stock for regular sale
    await deductSaleStock(sale);
    
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    console.error("Create sale error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE regular purchase (with STOCK ADDITION)
═══════════════════════════════════════════════════════════════════════════ */
export const createPurchase = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
      saleType: "purchase",
    };

    const sale = await Sale.create(body);
    
    // ADD stock for purchase (isRestore = true means add)
    for (const item of sale.items) {
      await updateProductStock(item.productId, item.measurement || item.uom, item.qty || item.pcs, true);
    }
    
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    console.error("Create purchase error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE raw purchase (with STOCK ADDITION)
═══════════════════════════════════════════════════════════════════════════ */
export const createRawPurchase = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();

    console.log("========== CREATING RAW PURCHASE ==========");
    console.log("Invoice No:", invoiceNo);

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || null,
      saleType: "raw-purchase",
    };

    const sale = await Sale.create(body);
    console.log("✅ Sale created:", sale.invoiceNo);
    
    // ADD stock for raw purchase
    for (const item of sale.items) {
      await updateProductStock(item.productId, item.measurement || item.uom, item.qty || item.pcs, true);
    }

    if (sale.customerId) {
      let customer = await Customer.findById(sale.customerId);
      
      if (!customer && sale.customerName !== "COUNTER SALE") {
        const lastCustomer = await Customer.findOne({}, {}, { sort: { createdAt: -1 } });
        let nextCode = 1;
        if (lastCustomer?.code) {
          nextCode = parseInt(lastCustomer.code) + 1;
        }
        
        customer = new Customer({
          _id: sale.customerId,
          name: sale.customerName,
          code: String(nextCode),
          type: "credit",
          currentBalance: sale.prevBalance || 0,
          openingBalance: sale.prevBalance || 0,
          openingBalanceType: "Debit",
          phone: sale.customerPhone || "",
        });
        
        await customer.save();
        console.log(`✅ Auto-created customer: ${customer.name}`);
      }
      
      if (customer && sale.paidAmount > 0) {
        const oldBalance = customer.currentBalance || 0;
        const newBalance = oldBalance - sale.paidAmount;
        
        customer.currentBalance = newBalance;
        await customer.save();
        
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

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE raw sale (with STOCK DEDUCTION)
═══════════════════════════════════════════════════════════════════════════ */
export const createRawSale = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();

    const body = {
      ...req.body,
      invoiceNo,
      customerName: req.body.customerName?.trim() || "COUNTER SALE",
      customerPhone: req.body.customerPhone?.trim() || "",
      customerId: req.body.customerId || undefined,
      saleType: "raw-sale",
    };

    const sale = await Sale.create(body);
    
    // DEDUCT stock for raw sale
    await deductSaleStock(sale);
    
    if (sale.customerId && sale.balance > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: sale.balance }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    console.error("Create raw sale error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE sale return (with STOCK ADDITION)
═══════════════════════════════════════════════════════════════════════════ */
// ✅ CORRECT - This ADDS stock back

// In saleController.js
export const createSaleReturn = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();

    const body = {
      ...req.body,
      invoiceNo,
      invoiceDate: req.body.returnDate || req.body.invoiceDate,
      saleType: "return",
    };

    const sale = await Sale.create(body);
    
    // ADD stock back for return (isRestore = true)
    for (const item of sale.items) {
      const uom = item.measurement || item.uom;
      const qty = item.qty || item.pcs;
      await updateProductStock(item.productId, uom, qty, true); // true = add stock
    }
    
    if (sale.customerId && sale.paidAmount > 0) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { currentBalance: -sale.paidAmount }
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    console.error("Create return error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   UPDATE sale (handles stock correctly)
═══════════════════════════════════════════════════════════════════════════ */
export const updateSale = async (req, res) => {
  try {
    const oldSale = await Sale.findById(req.params.id);
    if (!oldSale)
      return res.status(404).json({ success: false, message: "Not found" });

    const { invoiceNo, returnNo, saleType, ...updateData } = req.body;

    // STEP 1: Restore old stock
    await restoreSaleStock(oldSale);
    console.log(`✅ Old stock restored for sale: ${oldSale.invoiceNo}`);

    // STEP 2: Reverse old balance change
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

    // STEP 3: Update sale record
    const sale = await Sale.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    // STEP 4: Deduct new stock
    await deductSaleStock(sale);
    console.log(`✅ New stock deducted for sale: ${sale.invoiceNo}`);

    // STEP 5: Apply new balance change
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
    console.error("Update sale error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE sale (restores stock)
═══════════════════════════════════════════════════════════════════════════ */
export const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale)
      return res.status(404).json({ success: false, message: "Not found" });
    
    // STEP 1: Restore stock
    await restoreSaleStock(sale);
    console.log(`✅ Stock restored before deleting sale: ${sale.invoiceNo}`);
    
    // STEP 2: Reverse the balance change before deleting
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
    
    // STEP 3: Delete sale
    await Sale.findByIdAndDelete(req.params.id);
    console.log(`✅ Sale deleted: ${sale.invoiceNo}`);
    
    res.json({ success: true, message: "Sale deleted and stock restored" });
  } catch (e) {
    console.error("Delete sale error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};