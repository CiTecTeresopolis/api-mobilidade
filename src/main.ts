import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as express from 'express'; // 1. Importe o express

dotenv.config();
console.log('RESEND:', process.env.RESEND_API_KEY);
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 2. ADICIONE ESTAS DUAS LINHAS AQUI (Antes de tudo)
  // Isso permite que o servidor aceite as fotos vindas do celular
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  configureSwagger(app);
  configureValidationPipe(app);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}

function configureSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('PhillCode Firebase Auth')
    .setDescription('Aprenda a usar a autenticação com Firebase no NestJS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}

function configureValidationPipe(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // Remova o forbidNonWhitelisted temporariamente para testar
      forbidNonWhitelisted: false,
      exceptionFactory: (errors) => {
        // ISSO VAI MOSTRAR O ERRO REAL NO SEU TERMINAL (VS CODE)
        console.log('--- ERRO DE VALIDAÇÃO ---');
        errors.forEach((err) => {
          console.log(`Campo: ${err.property} - Erros:`, err.constraints);
        });
        return new BadRequestException(errors);
      },
    }),
  );
}

bootstrap();
