import mongoose from "mongoose";

const JournalVoucherSchema = new mongoose.Schema(
  {
    jvNo: { type: String, unique: true }, // JV-00001

    date: { type: String, required: true },

    // Debit side
    debitCode: { type: String, default: "" },
    debitAccountId: { type: String, default: "" }, // customer _id or fixed account key
    debitAccountTitle: { type: String, required: true },
    debitDescription: { type: String, default: "" },
    debitInvoice: { type: String, default: "" },
    debitAmount: { type: Number, default: 0 },

    // Credit side
    creditCode: { type: String, default: "" },
    creditAccountId: { type: String, default: "" },
    creditAccountTitle: { type: String, required: true },
    creditDescription: { type: String, default: "" },
    creditInvoice: { type: String, default: "" },
    creditAmount: { type: Number, default: 0 },

    remarks: { type: String, default: "" },
    sendSms: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Auto JV number
JournalVoucherSchema.pre("save", async function (next) {
  if (!this.jvNo) {
    const last = await mongoose
      .model("JournalVoucher", JournalVoucherSchema)
      .findOne({}, {}, { sort: { createdAt: -1 } });
    let num = 1;
    if (last?.jvNo) {
      const n = parseInt(last.jvNo.replace("JV-", ""));
      if (!isNaN(n)) num = n + 1;
    }
    this.jvNo = `JV-${String(num).padStart(5, "0")}`;
  }
  next();
});

export default mongoose.model("JournalVoucher", JournalVoucherSchema);
