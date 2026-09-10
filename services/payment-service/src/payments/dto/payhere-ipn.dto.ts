import { IsOptional, IsString } from "class-validator";

// PayHere's IPN posts application/x-www-form-urlencoded with these fields
// (plus a few we don't need, like card_holder_name — whitelisted out by
// the global ValidationPipe). https://support.payhere.lk/api-&-mobile-sdk
export class PayHereIpnDto {
  @IsString()
  merchant_id: string;

  @IsString()
  order_id: string;

  @IsString()
  payhere_amount: string;

  @IsString()
  payhere_currency: string;

  @IsString()
  status_code: string;

  @IsString()
  md5sig: string;

  @IsOptional()
  @IsString()
  payment_id?: string;

  @IsOptional()
  @IsString()
  status_message?: string;
}
