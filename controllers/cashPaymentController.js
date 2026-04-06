import CashPayment, { getNextCpvNumber } from "../models/CashPayment.js";
import mongoose from "mongoose";

// ── GET /cpv ──────────────────────────────────────────────────────────────────
export const getAll = async (req, res) => {
  try {
    const { search = "", from, to, limit = 200 } = req.query;

    const filter = {};
    if (search) filter.$text = { $search: search };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(new Date(to).setHours(23, 59, 59));
    }

    const rows = await CashPayment.find(filter)
      .sort({ date: -1, cpv_number: -1 })
      .limit(Number(limit))
      .lean();

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── GET /cpv/next-number ──────────────────────────────────────────────────────
export const getNextNumber = async (_req, res) => {
  try {
    const Counter = mongoose.model("Counter");
    const doc = await Counter.findById("cpv_number").lean();
    res.json({ cpv_number: doc ? doc.seq + 1 : 26300001 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── GET /cpv/:id ──────────────────────────────────────────────────────────────
export const getOne = async (req, res) => {
  try {
    const doc = await CashPayment.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── POST /cpv ─────────────────────────────────────────────────────────────────
export const create = async (req, res) => {
  try {
    const {
      date,
      code,
      account_title,
      description,
      invoice,
      amount,
      send_sms,
    } = req.body;
    const cpv_number = await getNextCpvNumber();
    const doc = await CashPayment.create({
      cpv_number,
      date: date ?? new Date(),
      code: code ?? "",
      account_title,
      description: description ?? "",
      invoice: invoice ?? 0,
      amount,
      send_sms: !!send_sms,
    });
    res.status(201).json({ _id: doc._id, cpv_number: doc.cpv_number });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── PUT /cpv/:id ──────────────────────────────────────────────────────────────
export const update = async (req, res) => {
  try {
    const {
      date,
      code,
      account_title,
      description,
      invoice,
      amount,
      send_sms,
    } = req.body;
    const doc = await CashPayment.findByIdAndUpdate(
      req.params.id,
      {
        date,
        code,
        account_title,
        description,
        invoice: invoice ?? 0,
        amount,
        send_sms: !!send_sms,
      },
      { new: true, runValidators: true },
    );
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, doc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ── DELETE /cpv/:id ───────────────────────────────────────────────────────────
export const remove = async (req, res) => {
  try {
    const doc = await CashPayment.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
