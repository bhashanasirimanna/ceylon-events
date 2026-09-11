import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { InternalEmailController } from "./internal-email.controller";

@Module({
  controllers: [InternalEmailController],
  providers: [EmailService],
})
export class EmailModule {}
