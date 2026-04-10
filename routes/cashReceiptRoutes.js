import express from "express";
import CashReceipt from "../models/CashReceipt.js";

const router = express.Router();

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

// Create new cash receipt
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
    
    const receipt = new CashReceipt({
      customerId: req.body.customerId,
      customerCode: req.body.customerCode || "",
      customerName: req.body.customerName,
      customerPhoto: req.body.customerPhoto || "",
      amount: req.body.amount,
      remarks: req.body.remarks || "",
      receiptDate: req.body.receiptDate || new Date().toISOString().split("T")[0],
      previousBalance: req.body.previousBalance || 0,
      newBalance: req.body.newBalance || 0,
    });
    
    console.log("📝 Creating receipt document:", receipt);
    
    await receipt.save();
    console.log("✅ Receipt saved successfully! Receipt No:", receipt.receiptNo);
    
    res.status(201).json({ success: true, data: receipt });
  } catch (err) {
    console.error("❌ Error saving receipt:", err);
    console.error("Error details:", err.message);
    
    // Check for duplicate key error
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

// Delete receipt (for undo)
router.delete("/:id", async (req, res) => {
  try {
    const receipt = await CashReceipt.findByIdAndDelete(req.params.id);
    if (!receipt) {
      return res
        .status(404)
        .json({ success: false, message: "Receipt not found" });
    }
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