import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
// 1. Removidos os imports do Mongoose

@Module({
  imports: [], // 2. Removido o MongooseModule.forFeature
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // 3. Exportamos apenas o Service
})
export class UsersModule {}