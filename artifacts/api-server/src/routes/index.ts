import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import invoiceRouter from "./invoices";
import recordsRouter from "./records";
import checkoutRouter from "./checkout";
import overviewRouter from "./overview";

const router: IRouter = Router();

router.use(healthRouter);
router.use(checkoutRouter);
// The initial workspace preview has no configured identity provider.
// Do not expose financial/customer administration in a published environment.
router.use((_req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(503).json({ error: "Administração indisponível: configure autenticação e autorização antes de publicar dados reais." });
    return;
  }
  next();
});
router.use(catalogRouter);
router.use(invoiceRouter);
router.use(recordsRouter);
router.use(overviewRouter);

export default router;
