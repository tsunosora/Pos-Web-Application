import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TaskPiketService } from './task-piket.service';
import { sendPiketPdf } from './piket-pdf.render';
import { PinAckDto, PinAuthDto, PinCheckinDto } from './task-board.dto';

/**
 * Pop-up piket untuk halaman ber-PIN (/so-designer, /produksi, /cetak) — tanpa JWT.
 * Setiap request wajib { designerId, pin }; data selalu milik akun tugas yang
 * terhubung ke PIN itu (Pengaturan → Desainer), tidak pernah milik orang lain.
 */
@Controller('task-board/pin')
export class TaskBoardPinController {
  constructor(private readonly piket: TaskPiketService) {}

  private async linkedUser(dto: PinAuthDto): Promise<number> {
    const { userId } = await this.piket.userForPin(dto.designerId, dto.pin);
    if (!userId)
      throw new BadRequestException('PIN ini belum terhubung ke akun tugas.');
    return userId;
  }

  @Post('state')
  state(@Body() dto: PinAuthDto) {
    return this.piket.pinState(dto.designerId, dto.pin);
  }

  @Post('board')
  board(@Body() dto: PinAuthDto) {
    return this.piket.pinBoard(dto.designerId, dto.pin);
  }

  @Post('board/pdf')
  @HttpCode(200)
  async boardPdf(@Body() dto: PinAuthDto, @Res() res: Response) {
    sendPiketPdf(res, await this.piket.pinPiketPdf(dto.designerId, dto.pin)); // PIN salah → 401
  }

  @Post('checkin')
  async checkin(@Body() dto: PinCheckinDto) {
    return this.piket.checkin(await this.linkedUser(dto), dto.shift);
  }

  @Post('warnings/ack')
  async ack(@Body() dto: PinAckDto) {
    return this.piket.ackWarnings(await this.linkedUser(dto), dto.ids);
  }

  @Post('items/:id/done')
  async done(@Param('id', ParseIntPipe) id: number, @Body() dto: PinAuthDto) {
    return this.piket.completeOwnItem(await this.linkedUser(dto), id);
  }
}
