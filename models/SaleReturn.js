import mongoose from "mongoose";

const saleReturnItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  code: { type: String, default: "" },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  uom: { type: String, default: "" },
  measurement: { type: String, default: "" },
  rack: { type: String, default: "" },
  pcs: { type: Number, default: 1 },
  qty: { type: Number, default: 1 },
  rate: { type: Number, default: 0 },
  disc: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
});

const saleReturnSchema = new mongoose.Schema(
  {
    returnNo: { type: String, unique: true, sparse: true },
    returnDate: { type: String, required: true },
    saleInvNo: { type: String, default: "" },
    
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: "" },
    customerCode: { type: String, default: "" },

    items: [saleReturnItemSchema],

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

// Auto-generate return number before saving
saleReturnSchema.pre("save", async function() {
  if (!this.returnNo) {
    try {
      const lastReturn = await mongoose.model("SaleReturn").findOne({}, {}, { sort: { createdAt: -1 } });
      let nextNum = 1;
      if (lastReturn && lastReturn.returnNo) {
        const num = parseInt(lastReturn.returnNo, 10);
        if (!isNaN(num)) nextNum = num + 1;
      }
      this.returnNo = String(nextNum);
      console.log(`Auto-generated sale return number: ${this.returnNo}`);
    } catch (err) {
      console.error("Error generating return number:", err);
      this.returnNo = String(Date.now());
    }
  }
});

// Create indexes
saleReturnSchema.index({ returnNo: 1 });
saleReturnSchema.index({ returnDate: -1 });
saleReturnSchema.index({ customerId: 1 });
saleReturnSchema.index({ createdAt: -1 });

export default mongoose.model("SaleReturn", saleReturnSchema);