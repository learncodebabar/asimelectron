import express from "express";
import {
  getNextRawPurchaseInvoice,
  createRawPurchase,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
} from "../controllers/saleController.js";

const router = express.Router();

router.get("/next-invoice", getNextRawPurchaseInvoice);
router.get("/", (req, res) => {
  req.query.saleType = "raw-purchase";
  getAllSales(req, res);
});
router.get("/:id", getSaleById);
router.post("/", createRawPurchase);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

export default router;
