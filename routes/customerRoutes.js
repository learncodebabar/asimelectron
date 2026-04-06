// routes/customerRoutes.js
import express from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
  getSaleHistory,
  getPurchaseHistory,
  getSuppliers,
  getSupplierPayables,
} from "../controllers/customerController.js";

const router = express.Router();

// Basic CRUD
router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

// History routes
router.get("/:id/sales", getSaleHistory);
router.get("/:id/purchases", getPurchaseHistory);

// Supplier specific routes
router.get("/suppliers/all", getSuppliers);
router.get("/suppliers/payables", getSupplierPayables);

export default router;