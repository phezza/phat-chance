import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const staticDir = process.env["STATIC_DIR"];

if (staticDir) {
  const absStatic = path.resolve(staticDir);
  if (!fs.existsSync(absStatic)) {
    logger.warn({ staticDir: absStatic }, "STATIC_DIR is set but the directory does not exist");
  } else {
    logger.info({ staticDir: absStatic }, "Serving static frontend");

    app.use(
      express.static(absStatic, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest")) {
            res.setHeader("Cache-Control", "no-cache");
          } else if (/\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );

    app.get(/^(?!\/api(?:\/|$)).*/, (req: Request, res: Response, next: NextFunction) => {
      const indexFile = path.join(absStatic, "index.html");
      if (!fs.existsSync(indexFile)) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexFile);
    });
  }
}

export default app;
