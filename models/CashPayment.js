// models/CashPayment.model.js
import mongoose from "mongoose";

// ── Auto-increment CPV number using a counter collection ─────────────────────
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "cpv_number"
  seq: { type: Number, default: 26300000 },
});
const Counter =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export const getNextCpvNumber = async () => {
  const doc = await Counter.findByIdAndUpdate(
    "cpv_number",
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
};

// ── Cash Payment Schema ───────────────────────────────────────────────────────
const cashPaymentSchema = new mongoose.Schema(
  {
    cpv_number: { type: Number, required: true, unique: true },
    date: { type: Date, required: true, default: Date.now },
    code: { type: String, default: "" },
    account_title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    invoice: { type: Number, default: 0 },
    amount: { type: Number, required: true, default: 0 },
    send_sms: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes for fast search ───────────────────────────────────────────────────
cashPaymentSchema.index({ cpv_number: -1 });
cashPaymentSchema.index({ date: -1 });
cashPaymentSchema.index({
  account_title: "text",
  description: "text",
  code: "text",
});

const CashPayment =
  mongoose.models.CashPayment ||
  mongoose.model("CashPayment", cashPaymentSchema);

export default CashPayment;
