import SaleReturn from "../models/SaleReturn.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";

/* ═══════════════════════════════════════════════════════════
   STOCK UPDATE HELPER FOR SALE RETURN (ADD STOCK BACK)
═══════════════════════════════════════════════════════════ */
const addProductStockForReturn = async (productId, uom, qtyReturned) => {
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
    const newStock = currentStock + qtyReturned;
    
    product.packingInfo[packingIndex].openingQty = newStock;
    await product.save();
    
    console.log(`📦 Sale Return: Added ${qtyReturned} ${uom} back to ${product.code}. Stock: ${currentStock} → ${newStock}`);
    return true;
  } catch (error) {
    console.error("Failed to update stock:", error);
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════
   GET all sale returns
═══════════════════════════════════════════════════════════ */
export const getAllSaleReturns = async (req, res) => {
  try {
    const { customerId, dateFrom, dateTo, search, limit } = req.query;

    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (dateFrom || dateTo) {
      filter.returnDate = {};
      if (dateFrom) filter.returnDate.$gte = dateFrom;
      if (dateTo) filter.returnDate.$lte = dateTo;
    }
    if (search) {
      const r = new RegExp(search, "i");
      filter.$or = [
        { returnNo: r },
        { customerName: r },
        { saleInvNo: r },
      ];
    }

    const returns = await SaleReturn.find(filter)
      .sort({ returnDate: -1, createdAt: -1 })
      .limit(Number(limit) || 1000);

    res.json({ success: true, data: returns, count: returns.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   GET single sale return
═══════════════════════════════════════════════════════════ */
export const getSaleReturnById = async (req, res) => {
  try {
    const saleReturn = await SaleReturn.findById(req.params.id).populate("customerId", "name phone code currentBalance");
    if (!saleReturn) {
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }
    res.json({ success: true, data: saleReturn });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   CREATE sale return (with STOCK ADDITION)
═══════════════════════════════════════════════════════════ */
export const createSaleReturn = async (req, res) => {
  try {
    const saleReturn = await SaleReturn.create(req.body);
    
    // ADD stock back for sale return
    for (const item of saleReturn.items) {
      await addProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        item.pcs || item.qty
      );
    }
    
    // Update customer balance if refund given
    if (saleReturn.customerId && saleReturn.paidAmount > 0) {
      await Customer.findByIdAndUpdate(saleReturn.customerId, {
        $inc: { currentBalance: -saleReturn.paidAmount }
      });
    }

    res.status(201).json({ success: true, data: saleReturn });
  } catch (e) {
    console.error("Create sale return error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   UPDATE sale return
═══════════════════════════════════════════════════════════ */
export const updateSaleReturn = async (req, res) => {
  try {
    const oldReturn = await SaleReturn.findById(req.params.id);
    if (!oldReturn) {
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }

    // Restore old stock first (subtract what was added)
    for (const item of oldReturn.items) {
      await addProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        -(item.pcs || item.qty)
      );
    }

    // Update return
    const saleReturn = await SaleReturn.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Add new stock
    for (const item of saleReturn.items) {
      await addProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        item.pcs || item.qty
      );
    }

    res.json({ success: true, data: saleReturn });
  } catch (e) {
    console.error("Update sale return error:", e);
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ═══════════════════════════════════════════════════════════
   DELETE sale return (restores stock)
═══════════════════════════════════════════════════════════ */
export const deleteSaleReturn = async (req, res) => {
  try {
    const saleReturn = await SaleReturn.findById(req.params.id);
    if (!saleReturn) {
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }
    
    // Restore stock (subtract what was added)
    for (const item of saleReturn.items) {
      await addProductStockForReturn(
        item.productId, 
        item.uom || item.measurement, 
        -(item.pcs || item.qty)
      );
    }
    
    await SaleReturn.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: "Sale return deleted and stock restored" });
  } catch (e) {
    console.error("Delete sale return error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};