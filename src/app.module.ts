import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { DriversController } from './auth/drivers';
import { EmailService } from './auth/email.service'; // Importação necessária
import { SupabaseService } from './supabase/supabase.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  // Incluímos o EmailService aqui para resolver o erro de dependência do AuthService
  providers: [AuthService, JwtStrategy, EmailService, SupabaseService],
  controllers: [AuthController, DriversController],
})
export class AppModule {}
