import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

import { ConfigService } from '@nestjs/config'; // Adicione este import

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    // Busca a variável usando o ConfigService do NestJS
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      console.error('❌ ERRO: RESEND_API_KEY não encontrada no ConfigService');
      throw new Error('RESEND_API_KEY não definida no ambiente');
    }

    this.resend = new Resend(apiKey);
    console.log('✅ Resend inicializado com sucesso no Railway');
  }

  async sendConfirmationEmail(email: string, confirmLink: string) {
    try {
      const data = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Bem-vindo ao TeresópolisMobilidade! Confirme sua conta 🚗',
        html: `
      <h1>Olá, Passageiro!</h1>
      <p>Falta pouco para vocé comecar a usar o TeresópolisMobilidade. Clique no botão abaixo para validar seu e-mail:</p>
      <a href="${confirmLink}" style="background:#28a745; color:white; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block;">
        Confirmar Minha Conta
      </a>
    `,
      });

      if (data.error) {
        console.error('Erro retornado pelo Resend:', data.error);
        throw new Error(data.error.message);
      }

      return data;
    } catch (error) {
      console.error('Falha crítica no envio de e-mail:', error);
      throw error;
    }
  }

  async sendDriverConfirmationEmail(email: string, confirmLink: string) {
    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Bem-vindo ao TereMobilidade! Confirme sua conta 🚗',
      html: `
      <h1>Olá, Motorista!</h1>
      <p>Falta pouco para você começar a dirigir conosco. Clique no botão abaixo para validar seu e-mail:</p>
      <a href="${confirmLink}" style="background:#28a745; color:white; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block;">
        Confirmar Minha Conta
      </a>
    `,
    });
  }

  async sendWelcomeEmail(email: string) {
    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Bem-vindo 🚀',
      html: `<h1>Cadastro realizado com sucesso!</h1>`,
    });
  }

  async sendResetPasswordEmail(email: string, resetLink: string) {
    await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Recuperação de Senha - TereMobilidade 🔑',
      html: `
      <h1>Redefinição de Senha</h1>
      <p>Você solicitou a alteração de sua senha. Clique no botão abaixo para prosseguir:</p>
      <a href="${resetLink}" style="
        display:inline-block;
        padding:12px 20px;
        background:#dc3545;
        color:#fff;
        text-decoration:none;
        border-radius:5px;
      ">
        Alterar Minha Senha
      </a>
      <p>Se você não solicitou isso, ignore este e-mail.</p>
    `,
    });
  }
}
