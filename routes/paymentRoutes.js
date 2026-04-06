// routes/paymentRoutes.js
import express from "express";
import {
  createPayment,
  getByCustomer,
  getBySale,
  getAll,
  deletePayment,
} from "../controllers/paymentController.js";

const router = express.Router();

router.get("/", getAll);
router.post("/", createPayment);
router.get("/customer/:customerId", getByCustomer);
router.get("/sale/:saleId", getBySale);
router.delete("/:id", deletePayment);

export default router;
