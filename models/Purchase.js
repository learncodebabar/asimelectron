// models/Purchase.js
import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },
});

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNo: { type: String, unique: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    supplierName: { type: String, required: true },
    purchaseDate: { type: String, required: true },
    items: [purchaseItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Partial", "Unpaid"],
      default: "Unpaid",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Auto-generate purchase number
purchaseSchema.pre("save", async function () {
  if (!this.purchaseNo) {
    const last = await mongoose
      .model("Purchase")
      .findOne({}, {}, { sort: { createdAt: -1 } });
    let num = 1;
    if (last?.purchaseNo) {
      const n = parseInt(last.purchaseNo.replace("PO-", ""));
      if (!isNaN(n)) num = n + 1;
    }
    this.purchaseNo = `PO-${String(num).padStart(5, "0")}`;
  }
});

export default mongoose.model("Purchase", purchaseSchema);