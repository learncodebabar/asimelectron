import mongoose from "mongoose";

const DamageItemSchema = new mongoose.Schema(
  {
    code: { type: String, default: "" },
    name: { type: String, required: true },
    uom: { type: String, default: "" }, // Unit of Measure
    packing: { type: Number, default: 1 },
    pcs: { type: Number, default: 1 }, // pieces per packing
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const DamageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["in", "out"], required: true },
    invoiceNo: { type: String, required: true, trim: true },
    invoiceDate: { type: String, required: true }, // "YYYY-MM-DD"
    buyerName: { type: String, default: "COUNTER SALE" },
    buyerCode: { type: String, default: "" },
    items: { type: [DamageItemSchema], default: [] },
    totalQty: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    billAmount: { type: Number, default: 0 },
    previousBalance: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    netReceivable: { type: Number, default: 0 },
    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

// Indexes
DamageSchema.index({ type: 1, invoiceNo: 1 }, { unique: true });
DamageSchema.index({ invoiceNo: "text", buyerName: "text" });

const Damage = mongoose.model("Damage", DamageSchema);

export default Damage;
