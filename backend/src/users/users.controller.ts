import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('roles')
  getRoles() {
    return this.usersService.fetchRoles();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() data: { name?: string, roleId?: number, phone?: string, password?: string }) {
    return this.usersService.updateUser(+id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('roles')
  createRole(@Body() data: { name: string }) {
    return this.usersService.createRole(data.name);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('roles/:id')
  updateRole(@Param('id') id: string, @Body() data: { name: string }) {
    return this.usersService.updateRole(+id, data.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.usersService.deleteRole(+id);
  }
}
