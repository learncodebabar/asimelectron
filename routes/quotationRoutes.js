// routes/quotation.routes.js
import express from "express";
import Quotation from "../models/Quotation.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   GET /quotations
 
───────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;

    let filter = {};
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter = {
        $or: [{ qtNo: regex }, { custName: regex }, { custPhone: regex }],
      };
    }

    const quotes = await Quotation.find(filter).sort({ createdAt: -1 }).lean();

    return res.json({ success: true, data: quotes });
  } catch (err) {
    console.error("GET /api/quotations error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /quotations
───────────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const {
      qtNo,
      qtDate,
      validTill,
      custName,
      custPhone,
      items,
      subTotal,
      discAmt,
      netTotal,
      extraDisc,
      remarks,
    } = req.body;

    if (!qtNo || !qtDate) {
      return res.status(400).json({
        success: false,
        message: "qtNo and qtDate are required",
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required",
      });
    }

    const saved = await Quotation.findOneAndUpdate(
      { qtNo },
      {
        qtNo,
        qtDate,
        validTill,
        custName,
        custPhone,
        items,
        subTotal,
        discAmt,
        netTotal,
        extraDisc: Number(extraDisc) || 0,
        remarks,
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
    console.error("POST /api/quotations error:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Quotation number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /quotations/:id
───────────────────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Quotation.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    return res.json({
      success: true,
      message: "Deleted successfully",
    });
  } catch (err) {
    console.error("DELETE /api/quotations error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
