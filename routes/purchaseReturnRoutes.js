import express from "express";
import {
  getAllPurchaseReturns,
  getPurchaseReturnById,
  createPurchaseReturn,
  updatePurchaseReturn,
  deletePurchaseReturn,
} from "../controllers/purchaseReturnController.js";

const router = express.Router();

router.get("/", getAllPurchaseReturns);
router.get("/:id", getPurchaseReturnById);
router.post("/", createPurchaseReturn);
router.put("/:id", updatePurchaseReturn);
router.delete("/:id", deletePurchaseReturn);

export default router;