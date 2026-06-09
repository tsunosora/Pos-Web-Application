import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';

@Module({
    controllers: [ArticlesController],
    providers: [ArticlesService],
    exports: [ArticlesService],
})
export class ArticlesModule {}
