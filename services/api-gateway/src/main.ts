import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter, requireEnv } from "@ceylon/nest-common";
import helmet from "helmet";
import { AppModule } from "./app.module";

// Defaults cover the three web portals' local-dev ports (see docker-compose.yml).
// A real deployment overrides this with its actual public origins.
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:4000",
  "http://localhost:4001",
  "http://localhost:4002",
];

async function bootstrap() {
  requireEnv(["JWT_ACCESS_SECRET"]);

  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : DEFAULT_ALLOWED_ORIGINS;
  app.enableCors({ origin: allowedOrigins });
  // No content-security-policy: this gateway only ever serves JSON (proxied
  // to/from the three web portals, which run on their own origins and set
  // their own CSP), so a policy meant for HTML pages has nothing to apply
  // to here and would just be dead configuration.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
