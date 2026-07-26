import {
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    ArrayNotEmpty,
} from 'class-validator';

export const COUNT_MODES = ['PCS', 'QTY', 'OMZET', 'NOTA'] as const;
export const METRIC_ROLES = ['CS', 'DESIGNER', 'OPERATOR'] as const;

export class UpsertCustomProductMetricDto {
    @IsString()
    @MaxLength(120)
    name!: string;

    @IsString()
    @MaxLength(40)
    label!: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    displayOrder?: number;

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    productVariantIds?: number[];

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    categoryIds?: number[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    nameKeywords?: string[];

    @IsIn(COUNT_MODES)
    countMode!: (typeof COUNT_MODES)[number];

    @IsArray()
    @ArrayNotEmpty()
    @IsIn(METRIC_ROLES, { each: true })
    roles!: (typeof METRIC_ROLES)[number][];
}
