import mongoose from "mongoose";

const packingSchema = new mongoose.Schema({
  measurement: { type: String, required: true },
  purchaseRate: { type: Number, default: 0 },
  saleRate: { type: Number, default: 0 },
  pDisc: { type: Number, default: 0 },
  packing: { type: Number, default: 0 },
  minQty: { type: Number, default: 0 },
  reorderQty: { type: Number, default: 0 },
  openingQty: { type: Number, default: 0 },
  stockEnabled: { type: Boolean, default: false },
});

const productSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true },
    code: { type: String, default: "" },
    company: { type: String, required: true },
    category: { type: String, required: true },
    webCategory: { type: String, default: "" },
    rackNo: { type: String, default: "" },
    description: { type: String, required: true },
    urduDesc: { type: String, default: "" },
    orderName: { type: String, default: "" },
    remarks: { type: String, default: "" },
    uploadProduct: { type: Boolean, default: false },
    packingInfo: [packingSchema],
  },
  { timestamps: true },
);

const Product = mongoose.model("Product", productSchema);
export default Product;
