import RawSale from "../models/RawSale.js";
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
   INVOICE NUMBER GENERATOR for Raw Sale (YYMM + 4 digit sequence)
═══════════════════════════════════════════════════════════ */
const generateInvoiceNumber = async () => {
  const currentYearMonth = getCurrentYearMonthCode();
  let maxSeqForMonth = 0;
  
  const rawSales = await RawSale.find({ 
    invoiceNo: { $regex: `^${currentYearMonth}`, $options: 'i' } 
  });
  
  for (const sale of rawSales) {
    if (sale.invoiceNo && sale.invoiceNo.length === 8 && /^\d+$/.test(sale.invoiceNo)) {
      const seqNum = parseInt(sale.invoiceNo.slice(-4), 10);
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
   STOCK UPDATE HELPER (Deduct stock)
═══════════════════════════════════════════════════════════ */
const deductProductStock = async (productId, uom, qty) => {
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
    const newStock = Math.max(0, currentStock - qty);
    
    product.packingInfo[packingIndex].openingQty = newStock;
    await product.save();
    
    console.log(`📦 Raw Sale: Deducted ${qty} ${uom} from ${product.code}. Stock: ${currentStock} → ${newStock}`);
    return true;
  } catch (error) {
    console.error("Failed to update stock:", error);
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════
   GET all raw sales
═══════════════════════════════════════════════════════════ */
export const getAllRawSales = async (req, res) => {
  try {
    const {
      customerId,
      dateFrom,
      dateTo,
      search,
      limit,
      invoiceNo,
    } = req.query;

    const filter = {};
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

    const rawSales = await RawSale.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .limit(Number(limit) || 1000);

    res.json({ success: true, data: rawSales, count: rawSales.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   GET single raw sale
═══════════════════════════════════════════════════════════ */
export const getRawSaleById = async (req, res) => {
  try {
    const rawSale = await RawSale.findById(req.params.id).populate(
      "customerId",
      "name phone code currentBalance creditLimit"
    );
    if (!rawSale)
      return res.status(404).json({ success: false, message: "Raw sale not found" });
    res.json({ success: true, data: rawSale });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   GET next invoice number
═══════════════════════════════════════════════════════════ */
export const getNextRawSaleInvoice = async (req, res) => {
  try {
    const invoiceNo = await generateInvoiceNumber();
    res.json({ success: true, data: { invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   CREATE raw sale (with STOCK DEDUCTION)
═══════════════════════════════════════════════════════════ */
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
      saleSource: "raw-sale",
    };

    const rawSale = await RawSale.create(body);
    
    // DEDUCT stock for raw sale
    for (const item of rawSale.items) {
      await deductProductStock(item.productId, item.uom || item.measurement, item.qty || item.pcs);
    }
    
    // Update customer balance if credit sale
    if (rawSale.customerId && rawSale.balance > 0) {
      await Customer.findByIdAndUpdate(rawSale.customerId, {
        $inc: { currentBalance: rawSale.balance }
      });
    }

    res.status(201).json({ success: true, data: rawSale });
  } catch (e) {
    console.error("Create raw sale error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   UPDATE raw sale
═══════════════════════════════════════════════════════════ */
export const updateRawSale = async (req, res) => {
  try {
    const oldRawSale = await RawSale.findById(req.params.id);
    if (!oldRawSale)
      return res.status(404).json({ success: false, message: "Raw sale not found" });

    // Restore old stock first
    for (const item of oldRawSale.items) {
      await deductProductStock(item.productId, item.uom || item.measurement, -(item.qty || item.pcs));
    }

    // Reverse old balance change
    if (oldRawSale.customerId && oldRawSale.balance > 0) {
      await Customer.findByIdAndUpdate(oldRawSale.customerId, {
        $inc: { currentBalance: -oldRawSale.balance }
      });
    }

    // Update raw sale
    const rawSale = await RawSale.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Deduct new stock
    for (const item of rawSale.items) {
      await deductProductStock(item.productId, item.uom || item.measurement, item.qty || item.pcs);
    }

    // Apply new balance change
    if (rawSale.customerId && rawSale.balance > 0) {
      await Customer.findByIdAndUpdate(rawSale.customerId, {
        $inc: { currentBalance: rawSale.balance }
      });
    }

    res.json({ success: true, data: rawSale });
  } catch (e) {
    console.error("Update raw sale error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   DELETE raw sale (restores stock)
═══════════════════════════════════════════════════════════ */
export const deleteRawSale = async (req, res) => {
  try {
    const rawSale = await RawSale.findById(req.params.id);
    if (!rawSale)
      return res.status(404).json({ success: false, message: "Raw sale not found" });
    
    // Restore stock (add back what was deducted)
    for (const item of rawSale.items) {
      await deductProductStock(item.productId, item.uom || item.measurement, -(item.qty || item.pcs));
    }
    
    // Reverse balance change
    if (rawSale.customerId && rawSale.balance > 0) {
      await Customer.findByIdAndUpdate(rawSale.customerId, {
        $inc: { currentBalance: -rawSale.balance }
      });
    }
    
    await RawSale.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: "Raw sale deleted and stock restored" });
  } catch (e) {
    console.error("Delete raw sale error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};