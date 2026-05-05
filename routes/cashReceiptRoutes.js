// routes/cashReceiptRoutes.js - Update the POST endpoint
import express from "express";
import CashReceipt from "../models/CashReceipt.js";
import Customer from "../models/Customer.js";

const router = express.Router();

// Get all receipts
router.get("/", async (req, res) => {
  try {
    const receipts = await CashReceipt.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: receipts });
  } catch (err) {
    console.error("Error in GET /:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get today's receipts
router.get("/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const receipts = await CashReceipt.find({ receiptDate: today }).sort({
      createdAt: -1,
    });
    res.json({ success: true, data: receipts });
  } catch (err) {
    console.error("Error in GET /today:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get receipts by date range
router.get("/by-date", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    if (startDate) query.receiptDate = { $gte: startDate };
    if (endDate) query.receiptDate = { ...query.receiptDate, $lte: endDate };

    const receipts = await CashReceipt.find(query).sort({
      receiptDate: -1,
      createdAt: -1,
    });
    res.json({ success: true, data: receipts });
  } catch (err) {
    console.error("Error in GET /by-date:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get receipts by customer
router.get("/customer/:customerId", async (req, res) => {
  try {
    const receipts = await CashReceipt.find({
      customerId: req.params.customerId,
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: receipts });
  } catch (err) {
    console.error("Error in GET /customer/:customerId:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single receipt
router.get("/:id", async (req, res) => {
  try {
    const receipt = await CashReceipt.findById(req.params.id);
    if (!receipt) {
      return res
        .status(404)
        .json({ success: false, message: "Receipt not found" });
    }
    res.json({ success: true, data: receipt });
  } catch (err) {
    console.error("Error in GET /:id:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new cash receipt - WITH BALANCE UPDATE
router.post("/", async (req, res) => {
  try {
    console.log("📥 Received POST request to /api/cash-receipts");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    if (!req.body.customerId) {
      console.error("❌ Missing customerId");
      return res.status(400).json({ success: false, message: "customerId is required" });
    }
    
    if (!req.body.customerName) {
      console.error("❌ Missing customerName");
      return res.status(400).json({ success: false, message: "customerName is required" });
    }
    
    if (!req.body.amount || req.body.amount <= 0) {
      console.error("❌ Invalid amount:", req.body.amount);
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }
    
    // Generate receipt number if not provided
    let receiptNo = req.body.receiptNo;
    if (!receiptNo) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      receiptNo = `CR-${year}${month}${day}-${random}`;
    }
    
    // 1. UPDATE CUSTOMER BALANCE FIRST
    const customer = await Customer.findById(req.body.customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    
    const oldBalance = customer.currentBalance || 0;
    const amount = req.body.amount;
    const newBalance = oldBalance - amount;
    
    console.log(`Updating customer balance: ${oldBalance} -> ${newBalance}`);
    customer.currentBalance = newBalance;
    await customer.save();
    console.log("✅ Customer balance updated successfully");
    
    // 2. Save the receipt
    const receipt = new CashReceipt({
      receiptNo: receiptNo,
      customerId: req.body.customerId,
      customerCode: req.body.customerCode || "",
      customerName: req.body.customerName,
      customerPhoto: req.body.customerPhoto || "",
      amount: amount,
      remarks: req.body.remarks || "",
      receiptDate: req.body.receiptDate || new Date().toISOString().split("T")[0],
      previousBalance: oldBalance,
      newBalance: newBalance,
    });
    
    console.log("📝 Creating receipt document:", receipt);
    
    await receipt.save();
    console.log("✅ Receipt saved successfully! Receipt No:", receipt.receiptNo);
    
    res.status(201).json({ 
      success: true, 
      data: receipt,
      balanceUpdate: {
        oldBalance,
        newBalance,
        amountDeducted: amount
      }
    });
  } catch (err) {
    console.error("❌ Error saving receipt:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Duplicate receipt number. Please try again." 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: err.message,
      details: err.toString()
    });
  }
});

// Delete receipt - also revert balance
router.delete("/:id", async (req, res) => {
  try {
    const receipt = await CashReceipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }
    
    // Revert customer balance
    const customer = await Customer.findById(receipt.customerId);
    if (customer) {
      customer.currentBalance = (customer.currentBalance || 0) + receipt.amount;
      await customer.save();
      console.log(`✅ Balance reverted for customer: ${customer.name}`);
    }
    
    await CashReceipt.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Receipt deleted", data: receipt });
  } catch (err) {
    console.error("Error in DELETE /:id:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get summary by date
router.get("/summary/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const receipts = await CashReceipt.find({ receiptDate: date });
    const total = receipts.reduce((sum, r) => sum + r.amount, 0);
    res.json({
      success: true,
      data: {
        date,
        total,
        count: receipts.length,
        receipts,
      },
    });
  } catch (err) {
    console.error("Error in GET /summary/:date:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;