// routes/cpv.routes.js
import { Router } from "express";
import {
  getAll,
  getNextNumber,
  getOne,
  create,
  update,
  remove,
} from "../controllers/cashPaymentController.js";

const router = Router();

router.get("/next-number", getNextNumber);
router.get("/", getAll);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
