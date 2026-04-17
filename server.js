import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import errorHandler from "./middleware/errorHandler.js";
import journalRoutes from "./routes/journalRoutes.js";
import holdBillRoutes from "./routes/holdBillsRoutes.js";
import quotationRoutes from "./routes/quotationRoutes.js";
import damageRoutes from "./routes/damageRoutes.js";
import cashPaymentRoutes from "./routes/cashPaymentRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import rawPurchaseRoutes from "./routes/rawPurchaseRoutes.js";
import rawSaleRoutes from "./routes/rawSaleRoutes.js";
import cashReceiptRoutes from "./routes/cashReceiptRoutes.js"; // MAKE SURE THIS EXISTS

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/raw-purchases", rawPurchaseRoutes);
app.use("/api/raw-sales", rawSaleRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/hold-bills", holdBillRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/damage", damageRoutes);
app.use("/api/cpv", cashPaymentRoutes);
app.use("/api/cash-receipts", cashReceiptRoutes); // MAKE SURE THIS LINE EXISTS



app.get("/", (req, res) => {
  res.json({ message: "Shop Management API is running" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});