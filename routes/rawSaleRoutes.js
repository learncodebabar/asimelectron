import express from "express";
import {
  getNextRawSaleInvoice,
  createRawSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
} from "../controllers/saleController.js";

const router = express.Router();

router.get("/next-invoice", getNextRawSaleInvoice);
router.get("/", (req, res) => {
  req.query.saleType = "raw-sale";
  getAllSales(req, res);
});
router.get("/:id", getSaleById);
router.post("/", createRawSale);
router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

export default router;
