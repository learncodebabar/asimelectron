// routes/rawPurchaseRoutes.js
import express from "express";
import {
  getNextRawPurchaseInvoice,
  createRawPurchase,
  getAllRawPurchases,
  getSaleById,
  updateSale,
  deleteSale,
} from "../controllers/saleController.js";

const router = express.Router();

router.get("/next-invoice", getNextRawPurchaseInvoice);
router.get("/", getAllRawPurchases);  // Now this function exists
router.get("/:id", getSaleById);
router.post("/", createRawPurchase);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

export default router;