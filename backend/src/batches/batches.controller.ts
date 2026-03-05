import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { BatchesService } from './batches.service';

@Controller('batches')
export class BatchesController {
    constructor(private readonly batchesService: BatchesService) { }

    @Post()
    create(@Body() createBatchDto: any) {
        return this.batchesService.create(createBatchDto);
    }

    @Get()
    findAll() {
        return this.batchesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.batchesService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateBatchDto: any) {
        return this.batchesService.update(id, updateBatchDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.batchesService.remove(id);
    }
}
