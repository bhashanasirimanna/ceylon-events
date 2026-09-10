import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { ListProofsQuery } from "./dto/list-proofs.query";
import { PayHereIpnDto } from "./dto/payhere-ipn.dto";
import { ReviewPaymentProofDto } from "./dto/review-payment-proof.dto";
import { SubmitPaymentProofDto } from "./dto/submit-payment-proof.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("initiate")
  @UseGuards(JwtAuthGuard)
  initiate(
    @Body() dto: InitiatePaymentDto,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.paymentsService.initiate(dto, authorizationHeader);
  }

  // Called by PayHere's servers directly — never by a browser, and
  // authenticated by its own md5 signature rather than a JWT.
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() dto: PayHereIpnDto) {
    await this.paymentsService.handleWebhook(dto);
    return "OK";
  }

  @Post(":orderId/proof")
  @UseGuards(JwtAuthGuard)
  submitProof(
    @Param("orderId") orderId: string,
    @Body() dto: SubmitPaymentProofDto,
    @Headers("authorization") authorizationHeader: string,
  ) {
    return this.paymentsService.submitProof(orderId, dto, authorizationHeader);
  }

  @Get("order/:orderId")
  @UseGuards(JwtAuthGuard)
  getForOrder(
    @Param("orderId") orderId: string,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.paymentsService.getForOrder(orderId, caller);
  }

  @Get("proofs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  listProofs(@Query() query: ListProofsQuery) {
    return this.paymentsService.listProofs(
      query.status,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Patch("proofs/:id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  approveProof(
    @Param("id") id: string,
    @Body() dto: ReviewPaymentProofDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.paymentsService.approveProof(id, dto, caller);
  }

  @Patch("proofs/:id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  rejectProof(
    @Param("id") id: string,
    @Body() dto: ReviewPaymentProofDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.paymentsService.rejectProof(id, dto, caller);
  }
}
