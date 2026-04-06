import express from "express";
import {
  getAllSales,
  getSaleById,
  getSaleSummary,
  createSale,
  updateSale,
  createSaleReturn,
  deleteSale,
  getNextInvoice,
} from "../controllers/saleController.js";

const router = express.Router();

router.get("/next-invoice", getNextInvoice);
router.get("/summary", getSaleSummary);
router.get("/", getAllSales);
router.get("/:id", getSaleById);
router.post("/", createSale);
router.post("/return", createSaleReturn);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);
export default router;
