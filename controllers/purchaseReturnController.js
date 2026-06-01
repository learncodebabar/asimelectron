import PurchaseReturn from "../models/PurchaseReturn.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";

/* ═══════════════════════════════════════════════════════════
   STOCK UPDATE HELPER FOR PURCHASE RETURN (DEDUCT STOCK)
═══════════════════════════════════════════════════════════ */
const deductProductStockForReturn = async (productId, uom, qtyReturned) => {
  try {
    if (!productId || !uom || !qtyReturned) return false;
    
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
    const newStock = Math.max(0, currentStock - qtyReturned);
    
    product.packingInfo[packingIndex].openingQty = newStock;
    await product.save();
    
    console.log(`📦 Purchase Return: Deducted ${qtyReturned} ${uom} from ${product.code}. Stock: ${currentStock} → ${newStock}`);
    return true;
  } catch (error) {
    console.error("Failed to update stock:", error);
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════
   GET all purchase returns
═══════════════════════════════════════════════════════════ */
export const getAllPurchaseReturns = async (req, res) => {
  try {
    const { supplierId, dateFrom, dateTo, search, limit } = req.query;

    const filter = {};
    if (supplierId) filter.supplierId = supplierId;
    if (dateFrom || dateTo) {
      filter.returnDate = {};
      if (dateFrom) filter.returnDate.$gte = dateFrom;
      if (dateTo) filter.returnDate.$lte = dateTo;
    }
    if (search) {
      const r = new RegExp(search, "i");
      filter.$or = [
        { returnNo: r },
        { supplierName: r },
        { purchaseInvNo: r },
      ];
    }

    const returns = await PurchaseReturn.find(filter)
      .sort({ returnDate: -1, createdAt: -1 })
      .limit(Number(limit) || 1000);

    res.json({ success: true, data: returns, count: returns.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   GET single purchase return
═══════════════════════════════════════════════════════════ */
export const getPurchaseReturnById = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.id).populate("supplierId", "name phone code");
    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }
    res.json({ success: true, data: purchaseReturn });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   CREATE purchase return (with STOCK DEDUCTION)
═══════════════════════════════════════════════════════════ */
export const createPurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.create(req.body);
    
    // DEDUCT stock for purchase return
    for (const item of purchaseReturn.items) {
      await deductProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        item.qty || item.pcs || item.quantity
      );
    }
    
    // Update supplier balance if refund given
    if (purchaseReturn.supplierId && purchaseReturn.paidAmount > 0) {
      await Customer.findByIdAndUpdate(purchaseReturn.supplierId, {
        $inc: { currentBalance: -purchaseReturn.paidAmount }
      });
    }

    res.status(201).json({ success: true, data: purchaseReturn });
  } catch (e) {
    console.error("Create purchase return error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   UPDATE purchase return
═══════════════════════════════════════════════════════════ */
export const updatePurchaseReturn = async (req, res) => {
  try {
    const oldReturn = await PurchaseReturn.findById(req.params.id);
    if (!oldReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    // Restore old stock first (add back what was deducted)
    for (const item of oldReturn.items) {
      await deductProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        -(item.qty || item.pcs || item.quantity)
      );
    }

    // Update return
    const purchaseReturn = await PurchaseReturn.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Deduct new stock
    for (const item of purchaseReturn.items) {
      await deductProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        item.qty || item.pcs || item.quantity
      );
    }

    res.json({ success: true, data: purchaseReturn });
  } catch (e) {
    console.error("Update purchase return error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   DELETE purchase return (restores stock)
═══════════════════════════════════════════════════════════ */
export const deletePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findById(req.params.id);
    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }
    
    // Restore stock (add back what was deducted)
    for (const item of purchaseReturn.items) {
      await deductProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        -(item.qty || item.pcs || item.quantity)
      );
    }
    
    await PurchaseReturn.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: "Purchase return deleted and stock restored" });
  } catch (e) {
    console.error("Delete purchase return error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};