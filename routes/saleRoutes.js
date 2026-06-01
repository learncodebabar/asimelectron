// routes/saleRoutes.js
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

// ✅ Route based on saleType in request body
router.post("/", (req, res) => {
  if (req.body.saleType === "return") {
    createSaleReturn(req, res);
  } else {
    createSale(req, res);
  }
});

router.put("/:id", updateSale);
router.delete("/:id", deleteSale);

export default router;