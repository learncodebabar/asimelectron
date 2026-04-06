import express from "express";
import {
  getAll,
  getNextJv,
  create,
  update,
  remove,
  getAccounts,
} from "../controllers/journalController.js";

const router = express.Router();

router.get("/next-jv", getNextJv);
router.get("/accounts", getAccounts);
router.get("/", getAll);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

export default router;
