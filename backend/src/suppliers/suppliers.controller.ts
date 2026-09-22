import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, Menu, MenuGuard } from '../auth/role-groups';

// Pemasok & harga beli = menu Stok (dulu cukup login: peran apa pun bisa mengubah harga beli).
@UseGuards(JwtAuthGuard, MenuGuard)
@Menu('/inventory')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.suppliersService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.suppliersService.update(id, body);
  }

  // Menghapus data induk: setingkat manajer (T-46).
  @Delete(':id')
  @UseGuards(ManagerGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.remove(id);
  }

  @Post(':id/items')
  addItem(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.suppliersService.addItem(id, body);
  }

  @Patch('items/:itemId')
  updateItem(@Param('itemId', ParseIntPipe) itemId: number, @Body() body: any) {
    return this.suppliersService.updateItem(itemId, body);
  }

  @Delete('items/:itemId')
  @UseGuards(ManagerGuard)
  removeItem(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.suppliersService.removeItem(itemId);
  }
}
