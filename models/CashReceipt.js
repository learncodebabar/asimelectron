import mongoose from "mongoose";

const cashReceiptSchema = new mongoose.Schema(
  {
    receiptNo: {
      type: String,
      unique: true,
      default: () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `CR-${year}${month}${day}-${random}`;
      },
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerCode: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhoto: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    remarks: {
      type: String,
      default: "",
    },
    receiptDate: {
      type: String,
      required: true,
      default: () => new Date().toISOString().split("T")[0],
    },
    previousBalance: {
      type: Number,
      required: true,
    },
    newBalance: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: String,
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
cashReceiptSchema.index({ receiptDate: -1 });
cashReceiptSchema.index({ customerId: 1 });
cashReceiptSchema.index({ receiptNo: 1 });

const CashReceipt = mongoose.model("CashReceipt", cashReceiptSchema);
export default CashReceipt;