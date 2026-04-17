// models/Damage.js
import mongoose from "mongoose";

const damageItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: false,
  },
  code: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  uom: {
    type: String,
    default: "",
  },
  rack: {
    type: String,
    default: "",
  },
  pcs: {
    type: Number,
    default: 1,
    min: 0,
  },
  qty: {
    type: Number,
    default: 1,
    min: 0,
  },
  rate: {
    type: Number,
    default: 0,
    min: 0,
  },
  amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  reason: {
    type: String,
    default: "",
    trim: true,
  },
}, {
  _id: false,
});

const damageSchema = new mongoose.Schema({
  damageNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  damageDate: {
    type: String,
    required: true,
  },
  invoiceNo: {
    type: String,
    required: true,
    trim: true,
  },
  invoiceDate: {
    type: String,
    required: true,
  },
  items: {
    type: [damageItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: "At least one item is required",
    },
  },
  totalQty: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  type: {
    type: String,
    enum: ["in", "out"],
    required: true,
    index: true,
  },
  createdBy: {
    type: String,
    default: "system",
  },
  notes: {
    type: String,
    default: "",
  },
}, {
  timestamps: true,
});

// REMOVED the problematic pre-save middleware
// The totals will be calculated on the frontend or in the route handler

// Create indexes for better query performance
damageSchema.index({ damageNo: 1, type: 1 });
damageSchema.index({ damageDate: -1 });
damageSchema.index({ createdAt: -1 });
damageSchema.index({ type: 1, damageDate: -1 });

const Damage = mongoose.model("Damage", damageSchema);

export default Damage;