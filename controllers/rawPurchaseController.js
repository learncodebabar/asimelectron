import RawPurchase from "../models/RawPurchase.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";

/* ═══════════════════════════════════════════════════════════
   HELPER: Get current year-month code (YYMM)
═══════════════════════════════════════════════════════════ */
const getCurrentYearMonthCode = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}${month}`;
};

/* ═══════════════════════════════════════════════════════════
   INVOICE NUMBER GENERATOR for Raw Purchase (YYMM + 4 digit sequence)
═══════════════════════════════════════════════════════════ */
const generateInvoiceNumber = async () => {
  const currentYearMonth = getCurrentYearMonthCode();
  let maxSeqForMonth = 0;
  
  const rawPurchases = await RawPurchase.find({ 
    invoiceNo: { $regex: `^${currentYearMonth}`, $options: 'i' } 
  });
  
  for (const purchase of rawPurchases) {
    if (purchase.invoiceNo && purchase.invoiceNo.length === 8 && /^\d+$/.test(purchase.invoiceNo)) {
      const seqNum = parseInt(purchase.invoiceNo.slice(-4), 10);
      if (!isNaN(seqNum) && seqNum > maxSeqForMonth) {
        maxSeqForMonth = seqNum;
      }
    }
  }
  
  const nextSeq = maxSeqForMonth + 1;
  const formattedSeq = nextSeq.toString().padStart(4, '0');
  return `${currentYearMonth}${formattedSeq}`;
};

/* ═══════════════════════════════════════════════════════════
   STOCK UPDATE HELPER (Add stock for purchase)
═══════════════════════════════════════════════════════════ */
const addProductStock = async (productId, uom, qty) => {
  try {
    if (!productId) return false;
    
    const product = await Product.findById(productId);
    if (!product || !product.packingInfo) {
      console.log(`⚠️ Product not found: ${productId}`);
      return false;
    }
    
    const packingIndex = product.packingInfo.findIndex(pk => pk.measurement === uom);
    if (packingIndex === -1) {
      console.log(`⚠️ Packing not found for ${uom} in product: ${productId}`);
      return false;
    }
    
    const currentStock = product.packingInfo[packingIndex].openingQty || 0;
    const newStock = currentStock + qty;
    
    product.packingInfo[packingIndex].openingQty = newStock;
    await product.save();
    
    console.log(`📦 Raw Purchase: Added ${qty} ${uom} to ${product.code}. Stock: ${currentStock} → ${newStock}`);
    return true;
  } catch (error) {
    console.error("Failed to update stock:", error);
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════
   GET all raw purchases
═══════════════════════════════════════════════════════════ */
export const getAllRawPurchases = async (req, res) => {
  try {
    const {
      supplierId,
      dateFrom,
      dateTo,
      search,
      limit,
      invoiceNo,
    } = req.query;

    const filter = {};
    if (invoiceNo) filter.invoiceNo = invoiceNo;
    if (supplierId) filter.supplierId = supplierId;

    if (dateFrom || dateTo) {
      filter.invoiceDate = {};
      if (dateFrom) filter.invoiceDate.$gte = dateFrom;
      if (dateTo) filter.invoiceDate.$lte = dateTo;
    }

    if (search) {
      const r = new RegExp(search, "i");
      filter.$or = [
        { invoiceNo: r },
        { supplierName: r },
      ];
    }

    const rawPurchases = await RawPurchase.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .limit(Number(limit) || 1000);

    res.json({ success: true, data: rawPurchases, count: rawPurchases.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   GET single raw purchase
═══════════════════════════════════════════════════════════ */
export const getRawPurchaseById = async (req, res) => {
  try {
    const rawPurchase = await RawPurchase.findById(req.params.id).populate(
      "supplierId",
      "name phone code currentBalance creditLimit"
    );
    if (!rawPurchase)
      return res.status(404).json({ success: false, message: "Raw purchase not found" });
    res.json({ success: true, data: rawPurchase });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   GET next invoice number
═══════════════════════════════════════════════════════════ */
export const getNextRawPurchaseInvoice = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.json({ success: true, data: { invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   CREATE raw purchase (with STOCK ADDITION)
═══════════════════════════════════════════════════════════ */
export const createRawPurchase = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();

    const body = {
      ...req.body,
      invoiceNo,
      supplierName: req.body.supplierName?.trim() || "CASH PURCHASE",
      supplierPhone: req.body.supplierPhone?.trim() || "",
      supplierId: req.body.supplierId || undefined,
      purchaseType: "raw-purchase",
      purchaseSource: "raw-purchase",
    };

    const rawPurchase = await RawPurchase.create(body);
    
    // ADD stock for raw purchase
    for (const item of rawPurchase.items) {
      await addProductStock(item.productId, item.uom || item.measurement, item.qty || item.pcs);
    }
    
    // Update supplier balance if credit purchase
    if (rawPurchase.supplierId && rawPurchase.balance > 0) {
      await Customer.findByIdAndUpdate(rawPurchase.supplierId, {
        $inc: { currentBalance: -rawPurchase.balance }
      });
    }

    res.status(201).json({ success: true, data: rawPurchase });
  } catch (e) {
    console.error("Create raw purchase error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   UPDATE raw purchase
═══════════════════════════════════════════════════════════ */
export const updateRawPurchase = async (req, res) => {
  try {
    const oldRawPurchase = await RawPurchase.findById(req.params.id);
    if (!oldRawPurchase)
      return res.status(404).json({ success: false, message: "Raw purchase not found" });

    // Restore old stock first (subtract what was added)
    for (const item of oldRawPurchase.items) {
      await addProductStock(item.productId, item.uom || item.measurement, -(item.qty || item.pcs));
    }

    // Reverse old balance change
    if (oldRawPurchase.supplierId && oldRawPurchase.balance > 0) {
      await Customer.findByIdAndUpdate(oldRawPurchase.supplierId, {
        $inc: { currentBalance: oldRawPurchase.balance }
      });
    }

    // Update raw purchase
    const rawPurchase = await RawPurchase.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Add new stock
    for (const item of rawPurchase.items) {
      await addProductStock(item.productId, item.uom || item.measurement, item.qty || item.pcs);
    }

    // Apply new balance change
    if (rawPurchase.supplierId && rawPurchase.balance > 0) {
      await Customer.findByIdAndUpdate(rawPurchase.supplierId, {
        $inc: { currentBalance: -rawPurchase.balance }
      });
    }

    res.json({ success: true, data: rawPurchase });
  } catch (e) {
    console.error("Update raw purchase error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   DELETE raw purchase (restores stock)
═══════════════════════════════════════════════════════════ */
export const deleteRawPurchase = async (req, res) => {
  try {
    const rawPurchase = await RawPurchase.findById(req.params.id);
    if (!rawPurchase)
      return res.status(404).json({ success: false, message: "Raw purchase not found" });
    
    // Restore stock (subtract what was added)
    for (const item of rawPurchase.items) {
      await addProductStock(item.productId, item.uom || item.measurement, -(item.qty || item.pcs));
    }
    
    // Reverse balance change
    if (rawPurchase.supplierId && rawPurchase.balance > 0) {
      await Customer.findByIdAndUpdate(rawPurchase.supplierId, {
        $inc: { currentBalance: rawPurchase.balance }
      });
    }
    
    await RawPurchase.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: "Raw purchase deleted and stock restored" });
  } catch (e) {
    console.error("Delete raw purchase error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};