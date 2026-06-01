// controllers/purchaseController.js
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: Get current year-month code (YYMM)
═══════════════════════════════════════════════════════════════════════════ */
const getCurrentYearMonthCode = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}${month}`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   INVOICE NUMBER GENERATOR for Purchase (YYMM + 4 digit sequence)
═══════════════════════════════════════════════════════════════════════════ */
const generatePurchaseInvoiceNumber = async () => {
  const currentYearMonth = getCurrentYearMonthCode();
  let maxSeqForMonth = 0;
  
  // Find all purchases with current year-month prefix (YYMMxxxx format)
  const purchases = await Purchase.find({ 
    invoiceNo: { $regex: `^${currentYearMonth}`, $options: 'i' } 
  });
  
  for (const purchase of purchases) {
    if (purchase.invoiceNo && purchase.invoiceNo.length === 8 && /^\d+$/.test(purchase.invoiceNo)) {
      const seqNum = parseInt(purchase.invoiceNo.slice(-4), 10);
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
   STOCK UPDATE FOR PURCHASE (Add stock)
═══════════════════════════════════════════════════════════════════════════ */
const updateProductStockForPurchase = async (productId, uom, qty) => {
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
    const newStock = currentStock + qty;
    
    product.packingInfo[packingIndex].openingQty = newStock;
    await product.save();
    
    console.log(`📦 Stock increased: ${product.code} - ${uom}: ${currentStock} → ${newStock} (+${qty})`);
    return true;
  } catch (error) {
    console.error("Failed to update stock:", error);
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   GET all purchases
═══════════════════════════════════════════════════════════════════════════ */
export const getAllPurchases = async (req, res) => {
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
      filter.purchaseDate = {};
      if (dateFrom) filter.purchaseDate.$gte = dateFrom;
      if (dateTo) filter.purchaseDate.$lte = dateTo;
    }

    if (search) {
      const r = new RegExp(search, "i");
      filter.$or = [
        { invoiceNo: r },
        { supplierName: r },
        { supplierCode: r },
      ];
    }

    const purchases = await Purchase.find(filter)
      .sort({ purchaseDate: -1, createdAt: -1 })
      .limit(Number(limit) || 1000);

    res.json({ success: true, data: purchases, count: purchases.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   GET single purchase
═══════════════════════════════════════════════════════════════════════════ */
export const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase)
      return res.status(404).json({ success: false, message: "Purchase not found" });
    res.json({ success: true, data: purchase });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   GET next invoice number for purchase
═══════════════════════════════════════════════════════════════════════════ */
export const getNextPurchaseInvoice = async (req, res) => {
  try {
    const invoiceNo = await generatePurchaseInvoiceNumber();
    res.json({ success: true, data: { invoiceNo } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE purchase (with STOCK ADDITION)
═══════════════════════════════════════════════════════════════════════════ */
// controllers/purchaseController.js - updated createPurchase
export const createPurchase = async (req, res) => {
  try {
    const invoiceNo = await generatePurchaseInvoiceNumber();

    // Format items to match Purchase model schema
    const formattedItems = (req.body.items || []).map(item => ({
      productId: item.productId,
      productName: item.productName || item.name || item.description,
      quantity: parseFloat(item.quantity || item.qty || item.pcs || 0),
      unitPrice: parseFloat(item.unitPrice || item.rate || 0),
      total: parseFloat(item.total || item.amount || 0)
    }));

    // Handle supplierId - if it's null or empty, don't include it
    const purchaseData = {
      invoiceNo: invoiceNo,
      supplierName: req.body.supplierName || "Cash Purchase",
      purchaseDate: req.body.purchaseDate || req.body.invoiceDate,
      items: formattedItems,
      subtotal: parseFloat(req.body.subtotal || req.body.subTotal || 0),
      discount: parseFloat(req.body.discount || req.body.extraDisc || 0),
      tax: parseFloat(req.body.tax || 0),
      totalAmount: parseFloat(req.body.totalAmount || req.body.netTotal || 0),
      paidAmount: parseFloat(req.body.paidAmount || 0),
      paymentStatus: req.body.paymentStatus || "Paid",
      notes: req.body.notes || req.body.remarks || "",
      invoiceDate: req.body.invoiceDate,
      username: req.body.username || "admin",
      userId: req.body.userId || null,
      remarks: req.body.remarks || "",
    };

    // Only add supplierId if it's a valid ObjectId and not null/empty string
    if (req.body.supplierId && req.body.supplierId !== 'null' && req.body.supplierId !== '') {
      purchaseData.supplierId = req.body.supplierId;
    }

    const purchase = await Purchase.create(purchaseData);
    
    // ADD stock for purchase
    for (const item of formattedItems) {
      const originalItem = req.body.items.find(i => i.productId === item.productId);
      const uom = originalItem?.uom || originalItem?.measurement;
      if (item.productId && uom && item.quantity > 0) {
        await updateProductStockForPurchase(item.productId, uom, item.quantity);
      }
    }
    
    console.log(`✅ Purchase created: ${purchase.invoiceNo} - Stock increased`);
    res.status(201).json({ success: true, data: purchase });
    
  } catch (e) {
    console.error("Create purchase error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   UPDATE purchase
═══════════════════════════════════════════════════════════════════════════ */
export const updatePurchase = async (req, res) => {
  try {
    const oldPurchase = await Purchase.findById(req.params.id);
    if (!oldPurchase)
      return res.status(404).json({ success: false, message: "Purchase not found" });

    // First, revert old stock changes
    for (const item of oldPurchase.items) {
      const originalItem = req.body.items?.find(i => i.productId === item.productId);
      const uom = originalItem?.uom || originalItem?.measurement;
      if (item.productId && uom && item.quantity > 0) {
        // Subtract the old quantity
        const product = await Product.findById(item.productId);
        if (product?.packingInfo) {
          const packingIndex = product.packingInfo.findIndex(pk => pk.measurement === uom);
          if (packingIndex !== -1) {
            product.packingInfo[packingIndex].openingQty = Math.max(0, (product.packingInfo[packingIndex].openingQty || 0) - item.quantity);
            await product.save();
          }
        }
      }
    }

    // Format items for update
    const formattedItems = (req.body.items || []).map(item => ({
      productId: item.productId,
      productName: item.productName || item.name || item.description,
      quantity: parseFloat(item.quantity || item.qty || item.pcs || 0),
      unitPrice: parseFloat(item.unitPrice || item.rate || 0),
      total: parseFloat(item.total || item.amount || 0)
    }));

    const purchaseData = {
      supplierId: req.body.supplierId,
      supplierName: req.body.supplierName,
      purchaseDate: req.body.purchaseDate || req.body.invoiceDate,
      items: formattedItems,
      subtotal: parseFloat(req.body.subtotal || req.body.subTotal || 0),
      discount: parseFloat(req.body.discount || req.body.extraDisc || 0),
      tax: parseFloat(req.body.tax || 0),
      totalAmount: parseFloat(req.body.totalAmount || req.body.netTotal || 0),
      paidAmount: parseFloat(req.body.paidAmount || 0),
      paymentStatus: req.body.paymentStatus || "Paid",
      notes: req.body.notes || req.body.remarks || "",
    };

    const purchase = await Purchase.findByIdAndUpdate(req.params.id, purchaseData, {
      new: true,
      runValidators: true,
    });

    // Add new stock
    for (const item of formattedItems) {
      const originalItem = req.body.items.find(i => i.productId === item.productId);
      const uom = originalItem?.uom || originalItem?.measurement;
      if (item.productId && uom && item.quantity > 0) {
        await updateProductStockForPurchase(item.productId, uom, item.quantity);
      }
    }

    res.json({ success: true, data: purchase });
  } catch (e) {
    console.error("Update purchase error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE purchase (revert stock)
═══════════════════════════════════════════════════════════════════════════ */
export const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase)
      return res.status(404).json({ success: false, message: "Purchase not found" });
    
    // Revert stock (subtract what was added)
    for (const item of purchase.items) {
      if (item.productId && item.quantity > 0) {
        const product = await Product.findById(item.productId);
        if (product?.packingInfo) {
          // Find the packing info - we need to know the UOM
          // This requires storing UOM in purchase items or getting from product
          for (const pk of product.packingInfo) {
            // Try to find matching measurement
            if (pk.measurement && item.productName?.includes(pk.measurement)) {
              const currentStock = pk.openingQty || 0;
              pk.openingQty = Math.max(0, currentStock - item.quantity);
              await product.save();
              break;
            }
          }
        }
      }
    }
    
    await Purchase.findByIdAndDelete(req.params.id);
    console.log(`✅ Purchase deleted: ${purchase.invoiceNo} - Stock reverted`);
    
    res.json({ success: true, message: "Purchase deleted and stock reverted" });
  } catch (e) {
    console.error("Delete purchase error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};