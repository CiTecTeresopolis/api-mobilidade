import { Controller, Body, Put, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put('update-profile')
  async updateProfile(@Request() req, @Body() body: { name?: string; email?: string }) {
    const userId = req.user.sub; // ID que vem do Token (JWT)
    return this.usersService.updateProfile(userId, body);
  }

  @Put('update-password')
  async updatePassword(@Request() req, @Body() body: { newPassword: string }) {
    const userId = req.user.sub;
    return this.usersService.updatePassword(userId, body.newPassword);
  }

  
}