// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from 'bcryptjs'; // Add this import
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
import cashReceiptRoutes from "./routes/cashReceiptRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({
  origin: true, // This allows all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
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
app.use("/api/cash-receipts", cashReceiptRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Shop Management API is running" });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// Create default admin user if not exists - FIXED VERSION
const createDefaultAdmin = async () => {
  try {
    // Check if admin exists
    const adminExists = await User.findOne({ username: 'admin' });
    
    if (!adminExists) {
      console.log('Creating default admin user...');
      
      // Hash the password before saving
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const adminUser = new User({
        username: 'admin',
        password: hashedPassword,
        name: 'System Administrator',
        email: 'admin@erp.com',
        role: 'admin',
        permissions: [],
        isActive: true
      });
      
      await adminUser.save();
      console.log('✅ Default admin user created successfully!');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('✅ Admin user already exists');
      
      // Optional: Verify password is correct and reset if needed
      const isValid = await bcrypt.compare('admin123', adminExists.password);
      if (!isValid) {
        console.log('⚠️ Admin password is incorrect, resetting...');
        const salt = await bcrypt.genSalt(10);
        adminExists.password = await bcrypt.hash('admin123', salt);
        await adminExists.save();
        console.log('✅ Admin password reset successfully!');
      }
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
};

app.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  // Wait a bit for database connection to stabilize
  setTimeout(async () => {
    await createDefaultAdmin();
  }, 1000);
});