import { Module } from '@nestjs/common';
import { PrinterRelayController } from './printer-relay.controller';
import { PrinterRelayService } from './printer-relay.service';
import { PrinterRelayRegistry } from './printer-relay.registry';

@Module({
    controllers: [PrinterRelayController],
    providers: [PrinterRelayService, PrinterRelayRegistry],
})
export class PrinterRelayModule { }
