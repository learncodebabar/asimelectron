import mongoose from "mongoose";

const rawPurchaseItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  code: { type: String, default: "" },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  uom: { type: String, default: "" },
  measurement: { type: String, default: "" },
  rack: { type: String, default: "" },
  pcs: { type: Number, required: true, default: 1 },
  qty: { type: Number, required: true, default: 1 },
  rate: { type: Number, default: 0 },
  disc: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
});

const rawPurchaseSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    invoiceDate: { type: String, required: true },
    
    purchaseType: {
      type: String,
      default: "raw-purchase",
      enum: ["raw-purchase"],
    },
    
    purchaseSource: {
      type: String,
      default: "raw-purchase",
      enum: ["cash", "credit", "raw-purchase"],
    },
    
    paymentMode: {
      type: String,
      default: "Cash",
      enum: ["Cash", "Credit", "Bank", "Cheque"],
    },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    supplierName: { type: String, default: "CASH PURCHASE" },
    supplierPhone: { type: String, default: "" },

    items: [rawPurchaseItemSchema],

    subTotal: { type: Number, default: 0 },
    extraDisc: { type: Number, default: 0 },
    discAmount: { type: Number, default: 0 },
    netTotal: { type: Number, default: 0 },
    prevBalance: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    sendSms: { type: Boolean, default: false },
    remarks: { type: String, default: "" },
    status: { type: String, default: "Active", enum: ["Active", "Cancelled"] },
    
    // User tracking
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

// Create indexes
rawPurchaseSchema.index({ invoiceNo: 1 });
rawPurchaseSchema.index({ invoiceDate: -1 });
rawPurchaseSchema.index({ supplierId: 1 });
rawPurchaseSchema.index({ userId: 1 });
rawPurchaseSchema.index({ createdAt: -1 });

export default mongoose.model("RawPurchase", rawPurchaseSchema);