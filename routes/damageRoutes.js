// routes/damage.routes.js
import express from "express";
import Damage from "../models/Damage.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   GET /damage?type=in|out&search=...
───────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const { type, search } = req.query;

    const filter = {};
    if (type === "in" || type === "out") filter.type = type;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ invoiceNo: regex }, { buyerName: regex }];
    }

    const records = await Damage.find(filter).sort({ createdAt: -1 }).lean();

    return res.json({ success: true, data: records });
  } catch (err) {
    console.error("GET /damage error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /damage/next-invoice?type=in|out
───────────────────────────────────────────────────────────── */
router.get("/next-invoice", async (req, res) => {
  try {
    const { type } = req.query;
    const prefix = type === "out" ? "DO" : "DI";

    const last = await Damage.findOne({ type: type === "out" ? "out" : "in" })
      .sort({ createdAt: -1 })
      .select("invoiceNo")
      .lean();

    let nextNum = 1;
    if (last?.invoiceNo) {
      const num = parseInt(last.invoiceNo.replace(/\D/g, ""), 10);
      if (!isNaN(num)) nextNum = num + 1;
    }

    const invoiceNo = `${prefix}-${String(nextNum).padStart(5, "0")}`;
    return res.json({ success: true, invoiceNo });
  } catch (err) {
    console.error("GET /damage/next-invoice error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /damage/:id
───────────────────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const record = await Damage.findById(req.params.id).lean();
    if (!record) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    return res.json({ success: true, data: record });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /damage
───────────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      type,
      invoiceNo,
      invoiceDate,
      buyerName,
      buyerCode,
      items,
      totalQty,
      netAmount,
      billAmount,
      previousBalance,
      balance,
      netReceivable,
      remarks,
    } = req.body;

    if (!type || !["in", "out"].includes(type)) {
      return res
        .status(400)
        .json({ success: false, message: "type must be 'in' or 'out'" });
    }
    if (!invoiceNo || !invoiceDate) {
      return res.status(400).json({
        success: false,
        message: "invoiceNo and invoiceDate required",
      });
    }
    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one item required" });
    }

    const saved = await Damage.findOneAndUpdate(
      { type, invoiceNo },
      {
        type,
        invoiceNo,
        invoiceDate,
        buyerName: buyerName || "COUNTER SALE",
        buyerCode: buyerCode || "",
        items,
        totalQty,
        netAmount,
        billAmount,
        previousBalance: Number(previousBalance) || 0,
        balance: Number(balance) || 0,
        netReceivable: Number(netReceivable) || 0,
        remarks: remarks || "",
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("POST /damage error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Invoice number already exists for this type",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /damage/:id
───────────────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Damage.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    return res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("DELETE /damage error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
