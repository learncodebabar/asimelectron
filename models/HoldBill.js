import mongoose from "mongoose";

const HoldBillSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String },
    amount: { type: Number, default: 0 },
    buyerName: { type: String, default: "COUNTER SALE" },
    buyerCode: { type: String, default: "" },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    customerType: { type: String, default: "" },
    prevBalance: { type: Number, default: 0 },
    extraDiscount: { type: Number, default: 0 },
    paymentMode: { type: String, default: "Cash" },
    saleSource: { type: String, default: "cash" },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          default: null,
        },
        code: String,
        name: String,
        uom: String,
        rack: String,
        pcs: Number,
        rate: Number,
        amount: Number,
      },
    ],
  },
  { timestamps: true },
);

const HoldBill = mongoose.model("HoldBill", HoldBillSchema);

export default HoldBill;
