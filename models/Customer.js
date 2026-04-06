// models/Customer.js
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    nameUrdu: { type: String, default: "" },
    phone: { type: String, default: "", trim: true },
    otherPhone: { type: String, default: "" },
    cell: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    area: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    creditLimit: { type: Number, default: 0 },
    type: {
      type: String,
      default: "walkin",
      enum: [
        "walkin",
        "credit",
        "wholesale",
        "debit",
        "raw-sale",
        "raw-purchase",
        "supplier",
      ],
    },
    currentBalance: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    openingBalanceType: {
      type: String,
      default: "Debit",
      enum: ["Debit", "Credit"],
    },
    openingBalanceDate: { type: String, default: "" },
    notes: { type: String, default: "" },
    // Images stored as base64 strings
    imageFront: { type: String, default: "" },
    imageBack: { type: String, default: "" },
  },
  { timestamps: true },
);

// Auto-generate code
customerSchema.pre("save", async function () {
  if (!this.code) {
    const last = await mongoose
      .model("Customer")
      .findOne({}, {}, { sort: { createdAt: -1 } });
    let num = 1;
    if (last?.code) {
      const n = parseInt(last.code);
      if (!isNaN(n)) num = n + 1;
    }
    this.code = String(num);
  }
});

export default mongoose.model("Customer", customerSchema);
