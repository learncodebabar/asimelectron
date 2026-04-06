// models/quotation.model.js
import mongoose from "mongoose";

const QuotationItemSchema = new mongoose.Schema(
  {
    code: { type: String, default: "" },
    description: { type: String, required: true },
    measurement: { type: String, default: "" },

    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    disc: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const QuotationSchema = new mongoose.Schema(
  {
    qtNo: { type: String, required: true, unique: true, trim: true },
    qtDate: { type: String, required: true }, // ISO date string "YYYY-MM-DD"
    validTill: { type: String, default: "" },
    custName: { type: String, default: "" },
    custPhone: { type: String, default: "" },
    items: { type: [QuotationItemSchema], default: [] },
    subTotal: { type: Number, default: 0 },
    discAmt: { type: Number, default: 0 },
    netTotal: { type: Number, default: 0 },
    extraDisc: { type: Number, default: 0 },
    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

// Index for fast search
QuotationSchema.index({
  qtNo: "text",
  custName: "text",
  custPhone: "text",
});

const Quotation = mongoose.model("Quotation", QuotationSchema);

export default Quotation;
