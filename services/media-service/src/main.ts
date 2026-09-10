import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter, requireEnv } from "@ceylon/nest-common";
import { AppModule } from "./app.module";

async function bootstrap() {
  requireEnv([
    "JWT_ACCESS_SECRET",
    "MINIO_ROOT_USER",
    "MINIO_ROOT_PASSWORD",
    "MEDIA_BUCKET",
  ]);

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
