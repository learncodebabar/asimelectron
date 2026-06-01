import express from "express";
import {
  getAllRawPurchases,
  getRawPurchaseById,
  getNextRawPurchaseInvoice,
  createRawPurchase,
  updateRawPurchase,
  deleteRawPurchase,
} from "../controllers/rawPurchaseController.js";

const router = express.Router();

router.get("/next-invoice", getNextRawPurchaseInvoice);
router.get("/", getAllRawPurchases);
router.get("/:id", getRawPurchaseById);
router.post("/", createRawPurchase);
router.put("/:id", updateRawPurchase);
router.delete("/:id", deleteRawPurchase);

export default router;