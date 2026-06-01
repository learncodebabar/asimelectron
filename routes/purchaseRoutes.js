// routes/purchaseRoutes.js
import express from "express";
import {
  getAllPurchases,
  getPurchaseById,
  getNextPurchaseInvoice,
  createPurchase,
  updatePurchase,
  deletePurchase,
} from "../controllers/purchaseController.js";

const router = express.Router();

router.get("/next-invoice", getNextPurchaseInvoice);
router.get("/", getAllPurchases);
router.get("/:id", getPurchaseById);
router.post("/", createPurchase);
router.put("/:id", updatePurchase);
router.delete("/:id", deletePurchase);

export default router;