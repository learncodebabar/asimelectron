import express from "express";
import {
  getAllRawSales,
  getRawSaleById,
  getNextRawSaleInvoice,
  createRawSale,
  updateRawSale,
  deleteRawSale,
} from "../controllers/rawSaleController.js";

const router = express.Router();

router.get("/next-invoice", getNextRawSaleInvoice);
router.get("/", getAllRawSales);
router.get("/:id", getRawSaleById);
router.post("/", createRawSale);
router.put("/:id", updateRawSale);
router.delete("/:id", deleteRawSale);

export default router;