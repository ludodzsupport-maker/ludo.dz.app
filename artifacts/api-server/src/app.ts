import express, {
  type Express,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import cors from "cors";
import * as pinoHttpModule from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

type PinoHttpRequest = Request & { id?: unknown };

type PinoHttpFactory = (options: {
  logger: typeof logger;
  serializers: {
    req(req: PinoHttpRequest): unknown;
    res(res: Response): unknown;
  };
}) => RequestHandler;

const pinoHttp = (
  "default" in pinoHttpModule ? pinoHttpModule.default : pinoHttpModule
) as PinoHttpFactory;

const app: Express = express();

app.use(
  pinoHttp({
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
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
