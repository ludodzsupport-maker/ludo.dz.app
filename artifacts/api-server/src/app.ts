import express, {
  type Express,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

type PinoHttpRequest = Request & { id?: unknown };

function noopMiddleware(): RequestHandler {
  return (_req, _res, next) => {
    next();
  };
}

function createPinoHttpMiddleware(): RequestHandler {
  const pinoLogger =
    typeof pinoHttp === "function" ? pinoHttp : (pinoHttp as any).default;

  if (typeof pinoLogger !== "function") {
    console.error("pino-http did not resolve to a callable middleware factory");
    return noopMiddleware();
  }

  try {
    return (pinoLogger as any)({
      logger,
      serializers: {
        req(req: PinoHttpRequest) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res: Response) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    });
  } catch (error) {
    console.error("Failed to initialize pino-http middleware", error);
    return noopMiddleware();
  }
}

const app: Express = express();

app.use(createPinoHttpMiddleware());
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "API Server is running successfully" });
});
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
