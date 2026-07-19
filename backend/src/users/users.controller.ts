import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Hanya OWNER/SUPERADMIN/ADMIN yang boleh membuat/mengubah/menghapus user & role.
// (RolesGuard mencocokkan case-insensitive, jadi cocok dengan role "Owner"/"Admin" di DB.)
const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() data: { name?: string, roleId?: number, phone?: string, password?: string }) {
    return this.usersService.updateUser(+id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post('roles')
  createRole(@Body() data: { name: string }) {
    return this.usersService.createRole(data.name);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch('roles/:id')
  updateRole(@Param('id') id: string, @Body() data: { name: string }) {
    return this.usersService.updateRole(+id, data.name);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.usersService.deleteRole(+id);
  }
}
