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

function renderPreviewHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ludo DZ Preview</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 20% 10%, rgba(34, 197, 94, 0.28), transparent 32rem),
          radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.24), transparent 28rem),
          linear-gradient(135deg, #07111f 0%, #101827 48%, #05070d 100%);
        color: #f8fafc;
      }
      main {
        width: min(94vw, 980px);
        display: grid;
        grid-template-columns: minmax(280px, 420px) 1fr;
        gap: 2rem;
        align-items: center;
        padding: 2rem;
      }
      .panel {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 28px;
        background: rgba(15, 23, 42, 0.78);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(18px);
      }
      .copy { padding: 2rem; }
      .eyebrow {
        margin: 0 0 0.75rem;
        color: #86efac;
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 { margin: 0; font-size: clamp(2.5rem, 8vw, 5rem); line-height: 0.9; }
      p { color: #cbd5e1; font-size: 1rem; line-height: 1.65; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1rem;
        padding: 0.65rem 0.9rem;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.14);
        color: #bbf7d0;
        font-weight: 700;
      }
      .dot { width: 0.7rem; height: 0.7rem; border-radius: 999px; background: #22c55e; box-shadow: 0 0 18px #22c55e; }
      .board-wrap { padding: 1.25rem; }
      .board {
        aspect-ratio: 1;
        display: grid;
        grid-template-columns: repeat(15, 1fr);
        grid-template-rows: repeat(15, 1fr);
        overflow: hidden;
        border-radius: 24px;
        border: 8px solid rgba(248, 250, 252, 0.9);
        background: #f8fafc;
      }
      .cell { border: 1px solid rgba(15, 23, 42, 0.08); background: #f8fafc; }
      .home { display: grid; place-items: center; font-size: 2rem; font-weight: 900; color: white; }
      .red { background: linear-gradient(135deg, #ef4444, #991b1b); }
      .blue { background: linear-gradient(135deg, #3b82f6, #1e3a8a); }
      .green { background: linear-gradient(135deg, #22c55e, #166534); }
      .yellow { background: linear-gradient(135deg, #facc15, #a16207); }
      .center {
        display: grid;
        place-items: center;
        background: conic-gradient(from 45deg, #ef4444, #3b82f6, #22c55e, #facc15, #ef4444);
        color: #020617;
        font-weight: 950;
        letter-spacing: -0.08em;
      }
      @media (max-width: 760px) {
        main { grid-template-columns: 1fr; padding: 1rem; }
        .copy { padding: 1.5rem; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel copy">
        <p class="eyebrow">Live visual preview</p>
        <h1>Ludo DZ</h1>
        <p>
          This API-server deployment is being used as a browser-visible preview surface.
          The full React game frontend already exists in <strong>artifacts/ludo-dz</strong>,
          but it is a separate Vite app and is not currently routed by this api-server Vercel deployment.
        </p>
        <div class="status"><span class="dot"></span> API server root is rendering HTML</div>
      </section>
      <section class="panel board-wrap" aria-label="Basic Ludo board preview">
        <div class="board">
          ${Array.from({ length: 225 }, (_, index) => `<div class="cell" style="grid-area:${Math.floor(index / 15) + 1} / ${(index % 15) + 1}"></div>`).join("")}
          <div class="home red" style="grid-area:1 / 1 / 7 / 7">DZ</div>
          <div class="home blue" style="grid-area:1 / 10 / 7 / 16">★</div>
          <div class="home green" style="grid-area:10 / 1 / 16 / 7">♟</div>
          <div class="home yellow" style="grid-area:10 / 10 / 16 / 16">⚑</div>
          <div class="center" style="grid-area:7 / 7 / 10 / 10">LUDO</div>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

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
  res.status(200).type("html").send(renderPreviewHtml());
});
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
