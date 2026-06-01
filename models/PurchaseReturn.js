import mongoose from "mongoose";

const purchaseReturnItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  code: { type: String, default: "" },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  uom: { type: String, default: "" },
  measurement: { type: String, default: "" },
  rack: { type: String, default: "" },
  pcs: { type: Number, default: 1 },
  qty: { type: Number, default: 1 },
  quantity: { type: Number, default: 1 },
  rate: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
});

const purchaseReturnSchema = new mongoose.Schema(
  {
    returnNo: { type: String, unique: true, sparse: true },
    returnDate: { type: String, required: true },
    purchaseInvNo: { type: String, default: "" },
    
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    supplierName: { type: String, required: true },
    supplierCode: { type: String, default: "" },
    supplierPhone: { type: String, default: "" },

    items: [purchaseReturnItemSchema],

    subTotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    netTotal: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Partial", "Unpaid"],
      default: "Paid",
    },

    notes: { type: String, default: "" },
    remarks: { type: String, default: "" },
    status: { type: String, default: "Active", enum: ["Active", "Cancelled"] },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    username: {
      type: String,
      required: true
    },
    counterId: {
      type: String,
      default: "default"
    },
    counterName: {
      type: String,
      default: "Main Counter"
    },
  },
  { timestamps: true }
);

// FIXED: Auto-generate return number before saving
purchaseReturnSchema.pre("save", async function() {
  if (!this.returnNo) {
    try {
      const lastReturn = await mongoose.model("PurchaseReturn").findOne({}, {}, { sort: { createdAt: -1 } });
      let nextNum = 1;
      if (lastReturn && lastReturn.returnNo) {
        const num = parseInt(lastReturn.returnNo, 10);
        if (!isNaN(num)) nextNum = num + 1;
      }
      this.returnNo = String(nextNum);
      console.log(`Auto-generated return number: ${this.returnNo}`);
    } catch (err) {
      console.error("Error generating return number:", err);
      this.returnNo = String(Date.now());
    }
  }
});

// Create indexes
purchaseReturnSchema.index({ returnNo: 1 });
purchaseReturnSchema.index({ returnDate: -1 });
purchaseReturnSchema.index({ supplierId: 1 });
purchaseReturnSchema.index({ createdAt: -1 });

export default mongoose.model("PurchaseReturn", purchaseReturnSchema);