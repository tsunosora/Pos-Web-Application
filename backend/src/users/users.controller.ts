import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { isManagerLevelRole } from '../auth/role-groups';

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

  // Semua staf butuh daftar nama (pilih kasir di POS, penanggung jawab lead, dsb.),
  // tapi nomor HP & pengaturan peran hanya untuk setingkat manajer (T-03).
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@Req() req: any) {
    const users = await this.usersService.findAll();
    if (isManagerLevelRole(req.user?.roleName)) return users;
    return users.map((u: any) => ({
      id: u.id, name: u.name, email: u.email, isActive: u.isActive, branchId: u.branchId,
      role: u.role ? { id: u.role.id, name: u.role.name } : null,
    }));
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

  // Tandai karyawan keluar (active:false) / aktifkan kembali (active:true).
  // Akun TIDAK dihapus supaya riwayat lead, kas & tugas tetap utuh di laporan.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id/status')
  setUserStatus(
    @Param('id') id: string,
    @Body() data: { active: boolean; note?: string },
    @Req() req: any,
  ) {
    return this.usersService.setStatus(+id, data, req?.user?.userId ?? null);
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

  // Atur menu yang boleh dilihat role tsb. body: { hrefs: string[] | null }
  // (null = reset ke preset divisi bawaan).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch('roles/:id/menu-access')
  updateRoleMenuAccess(@Param('id') id: string, @Body() data: { hrefs: string[] | null }) {
    return this.usersService.updateRoleMenuAccess(+id, data?.hrefs ?? null);
  }
}
