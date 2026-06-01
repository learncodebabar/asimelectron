import express from "express";
import {
  getAllSaleReturns,
  getSaleReturnById,
  createSaleReturn,
  updateSaleReturn,
  deleteSaleReturn,
} from "../controllers/saleReturnController.js";

const router = express.Router();

router.get("/", getAllSaleReturns);
router.get("/:id", getSaleReturnById);
router.post("/", createSaleReturn);
router.put("/:id", updateSaleReturn);
router.delete("/:id", deleteSaleReturn);

export default router;