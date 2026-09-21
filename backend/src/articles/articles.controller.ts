import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Menu, MenuGuard } from '../auth/role-groups';
import { ArticlesService, type ArticleInput } from './articles.service';

// Menulis/menerbitkan artikel publik hanya untuk peran yang diberi menu Artikel (T-47).
@Menu('/articles')
@Controller('articles')
export class ArticlesController {
    constructor(private readonly articles: ArticlesService) {}

    // ── Publik (tanpa auth) — taruh sebelum route :id ──
    @Get('public')
    listPublic(@Query('limit') limit?: string) {
        const n = limit ? parseInt(limit, 10) : undefined;
        return this.articles.listPublic(Number.isFinite(n as number) ? n : undefined);
    }

    @Get('public/:slug')
    getBySlug(@Param('slug') slug: string) {
        return this.articles.getBySlugPublic(slug);
    }

    // ── Admin (JWT) ──
    @UseGuards(JwtAuthGuard)
    @Get()
    list() {
        return this.articles.list();
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    getOne(@Param('id', ParseIntPipe) id: number) {
        return this.articles.getOne(id);
    }

    @UseGuards(JwtAuthGuard, MenuGuard)
    @Post()
    create(@Body() body: ArticleInput) {
        return this.articles.create(body);
    }

    @UseGuards(JwtAuthGuard, MenuGuard)
    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: ArticleInput) {
        return this.articles.update(id, body);
    }

    @UseGuards(JwtAuthGuard, MenuGuard)
    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.articles.remove(id);
    }
}
