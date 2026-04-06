// models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerType: {
      type: String,
      enum: ["walkin", "credit", "wholesale"],
      default: "walkin",
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    },
    invoiceNo: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    paymentDate: {
      type: String,
      default: () => new Date().toISOString().split("T")[0],
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "Bank", "Cheque", "Online"],
      default: "Cash",
    },
    remarks: { type: String, default: "" },
    recordedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
