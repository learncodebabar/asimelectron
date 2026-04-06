import express from "express";
import HoldBill from "../models/HoldBill.js";

const router = express.Router();

// GET all hold bills
router.get("/", async (req, res) => {
  try {
    const bills = await HoldBill.find().sort({ createdAt: -1 });
    res.json({ success: true, data: bills });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST create hold bill
router.post("/", async (req, res) => {
  try {
    const bill = await HoldBill.create(req.body);
    res.json({ success: true, data: bill });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE hold bill by id
router.delete("/:id", async (req, res) => {
  try {
    await HoldBill.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
