import express from "express";
import {
  getNextPurchaseInvoice,
  createPurchase,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
} from "../controllers/saleController.js";

const router = express.Router();

router.get("/next-invoice", getNextPurchaseInvoice);
router.get("/", (req, res) => {
  req.query.saleType = "purchase";
  getAllSales(req, res);
});
router.get("/:id", getSaleById);
router.post("/", createPurchase);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

export default router;
