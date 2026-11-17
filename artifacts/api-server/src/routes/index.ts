import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import invoiceRouter from "./invoices";
import recordsRouter from "./records";
import overviewRouter from "./overview";
import authRouter from "./auth";
import storageRouter from "./storage";
import { requireAdmin } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.use(healthRouter);
router.all(/^\/checkout(?:\/.*)?$/, (_req, res) => {
  res.status(410).json({ error: "Este endereço de compra não está mais disponível." });
});
router.use(authRouter);
router.use(storageRouter);
router.use(requireAdmin);
router.use(catalogRouter);
router.use(invoiceRouter);
router.use(recordsRouter);
router.use(overviewRouter);

export default router;
