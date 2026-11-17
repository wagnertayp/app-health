import express, { type Express, type ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
const handleError: ErrorRequestHandler = (err, req, res, _next) => {
  req.log.error({ err }, "Request failed");
  if (res.headersSent) return;
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "O conteúdo da solicitação é inválido." });
    return;
  }
  res.status(500).json({ error: "Não foi possível concluir a operação. Tente novamente." });
};
app.use(handleError);

export default app;
