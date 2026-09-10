import { Module } from "@nestjs/common";
import { AuthCommonModule } from "@ceylon/nest-common";
import { UploadsController } from "./uploads.controller";
import { MediaStorageService } from "./media-storage.service";

@Module({
  imports: [
    AuthCommonModule.forRoot(
      process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_me",
    ),
  ],
  controllers: [UploadsController],
  providers: [MediaStorageService],
})
export class UploadsModule {}
