import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    // Dev-only: this SMTP host is Mailpit (see docker-compose.yml), a
    // local catcher with no real delivery and no auth — a real deployment
    // points these same env vars at a real SMTP provider instead.
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "mailpit",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
    });
    this.from = process.env.SMTP_FROM ?? "Ceylon Events <no-reply@ceylonevents.local>";
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${params.to}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
