import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

export class BomItemDto {
    @IsString()
    name: string;

    @IsNumber()
    @Min(0)
    quantity: number;

    @IsString()
    unit: string;

    @IsNumber()
    @Min(0)
    price: number; // harga per unit bahan

    @IsOptional()
    @IsBoolean()
    isServiceCost?: boolean;

    @IsOptional()
    @IsBoolean()
    isShared?: boolean;

    @IsOptional()
    @IsInt()
    rawMaterialVariantId?: number | null; // untuk potong stok saat transaksi
}

export class VariantBomDto {
    @IsInt()
    variantId: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BomItemDto)
    items: BomItemDto[];
}

export class ApplyVariantsBomDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => VariantBomDto)
    variants: VariantBomDto[];
}
