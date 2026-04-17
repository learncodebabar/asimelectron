// routes/damageRoutes.js
import express from "express";
import Damage from "../models/Damage.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   GET /api/damage
   Get all damage records with optional type filter
   Query params:
   - type: 'in' or 'out' (optional)
   - search: search by damageNo (optional)
   - page: page number for pagination (optional)
   - limit: items per page (optional)
───────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const { type, search, page = 1, limit = 50 } = req.query;

    let filter = {};
    
    // Filter by type (in/out) if provided
    if (type && (type === "in" || type === "out")) {
      filter.type = type;
    }
    
    // Search by damageNo if provided
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.damageNo = regex;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [damageRecords, total] = await Promise.all([
      Damage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Damage.countDocuments(filter)
    ]);

    return res.json({ 
      success: true, 
      data: damageRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("GET /api/damage error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/damage/next-invoice
   Get next available damage number for a specific type
───────────────────────────────────────────────────────────── */
router.get("/next-invoice", async (req, res) => {
  try {
    const { type } = req.query;
    
    if (!type || (type !== "in" && type !== "out")) {
      return res.status(400).json({
        success: false,
        message: "Valid type (in/out) is required",
      });
    }
    
    // Find the highest damage number for this type
    const lastRecord = await Damage.findOne({ type })
      .sort({ damageNo: -1 })
      .lean();
    
    let nextNumber = 1;
    if (lastRecord && lastRecord.damageNo) {
      const lastNum = parseInt(lastRecord.damageNo);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }
    
    return res.json({
      success: true,
      data: { nextNumber: String(nextNumber) }
    });
  } catch (err) {
    console.error("GET /api/damage/next-invoice error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/damage/in
   Get all damage IN records (type='in')
───────────────────────────────────────────────────────────── */
router.get("/in", async (req, res) => {
  try {
    const { search } = req.query;
    let filter = { type: "in" };
    
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.damageNo = regex;
    }
    
    const damageRecords = await Damage.find(filter)
      .sort({ damageNo: -1 })
      .lean();
    
    return res.json({ success: true, data: damageRecords });
  } catch (err) {
    console.error("GET /api/damage/in error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/damage/out
   Get all damage OUT records (type='out')
───────────────────────────────────────────────────────────── */
router.get("/out", async (req, res) => {
  try {
    const { search } = req.query;
    let filter = { type: "out" };
    
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.damageNo = regex;
    }
    
    const damageRecords = await Damage.find(filter)
      .sort({ damageNo: -1 })
      .lean();
    
    return res.json({ success: true, data: damageRecords });
  } catch (err) {
    console.error("GET /api/damage/out error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/damage/:id
   Get a single damage record by ID
───────────────────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const damageRecord = await Damage.findById(req.params.id).lean();
    
    if (!damageRecord) {
      return res.status(404).json({
        success: false,
        message: "Damage record not found",
      });
    }
    
    return res.json({ success: true, data: damageRecord });
  } catch (err) {
    console.error("GET /api/damage/:id error:", err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ success: false, message: "Invalid ID format" });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/damage
   Create a new damage record (in or out)
───────────────────────────────────────────────────────────── */
// routes/damageRoutes.js (POST route only - corrected)
router.post("/", async (req, res) => {
  try {
    const {
      damageNo,
      damageDate,
      invoiceNo,
      invoiceDate,
      items,
      totalQty,
      totalAmount,
      type,
      notes,
    } = req.body;

    console.log("Received damage data:", { damageNo, damageDate, type, itemsCount: items?.length });

    // Validate required fields
    if (!damageNo || !damageDate) {
      return res.status(400).json({
        success: false,
        message: "damageNo and damageDate are required",
      });
    }
    
    if (!invoiceNo || !invoiceDate) {
      return res.status(400).json({
        success: false,
        message: "invoiceNo and invoiceDate are required",
      });
    }
    
    if (!type || (type !== "in" && type !== "out")) {
      return res.status(400).json({
        success: false,
        message: "Valid type (in/out) is required",
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required",
      });
    }

    // Check if damage number already exists
    const existing = await Damage.findOne({ damageNo });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Damage record with number ${damageNo} already exists`,
      });
    }

    // Calculate totals if not provided
    const calculatedTotalQty = totalQty || items.reduce((sum, item) => sum + (parseFloat(item.pcs) || parseFloat(item.qty) || 0), 0);
    const calculatedTotalAmount = totalAmount || items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    // Create new damage record - using plain object instead of new Damage()
    const damageRecordData = {
      damageNo,
      damageDate,
      invoiceNo,
      invoiceDate,
      items: items.map(item => ({
        productId: item.productId,
        code: item.code,
        name: item.name,
        description: item.description || item.name,
        uom: item.uom,
        rack: item.rack,
        pcs: parseFloat(item.pcs) || parseFloat(item.qty) || 1,
        qty: parseFloat(item.qty) || parseFloat(item.pcs) || 1,
        rate: parseFloat(item.rate) || 0,
        amount: parseFloat(item.amount) || 0,
        reason: item.reason || "",
      })),
      totalQty: calculatedTotalQty,
      totalAmount: calculatedTotalAmount,
      type,
      notes: notes || "",
    };

    // Use create() method instead of save()
    const saved = await Damage.create(damageRecordData);

    console.log("Damage record saved successfully:", saved._id);

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("POST /api/damage error:", err);
    
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Damage number already exists",
      });
    }
    
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: err.errors,
      });
    }
    
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});
/* ─────────────────────────────────────────────────────────────
   PUT /api/damage/:id
   Update an existing damage record
───────────────────────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const {
      damageNo,
      damageDate,
      invoiceNo,
      invoiceDate,
      items,
      totalQty,
      totalAmount,
      type,
      notes,
    } = req.body;

    const damageRecord = await Damage.findById(req.params.id);
    
    if (!damageRecord) {
      return res.status(404).json({
        success: false,
        message: "Damage record not found",
      });
    }

    // Validate required fields
    if (!damageNo || !damageDate) {
      return res.status(400).json({
        success: false,
        message: "damageNo and damageDate are required",
      });
    }
    
    if (!invoiceNo || !invoiceDate) {
      return res.status(400).json({
        success: false,
        message: "invoiceNo and invoiceDate are required",
      });
    }
    
    if (!type || (type !== "in" && type !== "out")) {
      return res.status(400).json({
        success: false,
        message: "Valid type (in/out) is required",
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required",
      });
    }

    // Check if new damage number conflicts with another record
    if (damageRecord.damageNo !== damageNo) {
      const existing = await Damage.findOne({ damageNo, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Damage record with number ${damageNo} already exists`,
        });
      }
    }

    // Calculate totals if not provided
    const calculatedTotalQty = totalQty || items.reduce((sum, item) => sum + (item.pcs || item.qty || 0), 0);
    const calculatedTotalAmount = totalAmount || items.reduce((sum, item) => sum + (item.amount || 0), 0);

    // Update record
    damageRecord.damageNo = damageNo;
    damageRecord.damageDate = damageDate;
    damageRecord.invoiceNo = invoiceNo;
    damageRecord.invoiceDate = invoiceDate;
    damageRecord.items = items.map(item => ({
      productId: item.productId,
      code: item.code,
      name: item.name,
      description: item.description || item.name,
      uom: item.uom,
      rack: item.rack,
      pcs: item.pcs || item.qty || 1,
      qty: item.qty || item.pcs || 1,
      rate: item.rate || 0,
      amount: item.amount || 0,
      reason: item.reason || "",
    }));
    damageRecord.totalQty = calculatedTotalQty;
    damageRecord.totalAmount = calculatedTotalAmount;
    damageRecord.type = type;
    damageRecord.notes = notes || damageRecord.notes;

    const updated = await damageRecord.save();

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("PUT /api/damage/:id error:", err);
    
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Damage number already exists",
      });
    }
    
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/damage/:id
   Delete a damage record
───────────────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Damage.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Damage record not found",
      });
    }
    
    return res.json({
      success: true,
      message: "Damage record deleted successfully",
    });
  } catch (err) {
    console.error("DELETE /api/damage/:id error:", err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ success: false, message: "Invalid ID format" });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/damage/summary/:type
   Get summary statistics for damage records
───────────────────────────────────────────────────────────── */
router.get("/summary/:type", async (req, res) => {
  try {
    const { type } = req.params;
    
    if (type !== "in" && type !== "out") {
      return res.status(400).json({
        success: false,
        message: "Valid type (in/out) is required",
      });
    }
    
    const [totalRecords, totalAmount, last30Days] = await Promise.all([
      Damage.countDocuments({ type }),
      Damage.aggregate([
        { $match: { type } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      Damage.aggregate([
        {
          $match: {
            type,
            createdAt: {
              $gte: new Date(new Date().setDate(new Date().getDate() - 30))
            }
          }
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ])
    ]);
    
    return res.json({
      success: true,
      data: {
        type,
        totalRecords,
        totalAmount: totalAmount[0]?.total || 0,
        last30DaysAmount: last30Days[0]?.total || 0,
      }
    });
  } catch (err) {
    console.error("GET /api/damage/summary/:type error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;