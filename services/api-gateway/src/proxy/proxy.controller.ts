import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ProxyService } from "./proxy.service";

@Controller("api")
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All("*")
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyService.forward(req, res);
  }
}
