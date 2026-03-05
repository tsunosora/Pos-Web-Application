import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // Seed dummy branches if none exist for Profit Map visualization
        const count = await this.prisma.branch.count();
        if (count === 0) {
            await this.prisma.branch.createMany({
                data: [
                    { name: 'Cabang Sudirman', address: 'Jakarta Pusat', latitude: -6.2146, longitude: 106.8173 },
                    { name: 'Cabang Kelapa Gading', address: 'Jakarta Utara', latitude: -6.1557, longitude: 106.9039 },
                    { name: 'Cabang Kemang', address: 'Jakarta Selatan', latitude: -6.2624, longitude: 106.8130 },
                    { name: 'Cabang PIK', address: 'Jakarta Barat', latitude: -6.1084, longitude: 106.7370 },
                ]
            });
        }
    }

    async findAll() {
        const branches = await this.prisma.branch.findMany();

        // Mock omset and margin for Peta Cuan visualization
        const mockData = [
            { id: 1, omset: 12500000, margin: 42 }, // Tinggi (Sudirman)
            { id: 2, omset: 8200000, margin: 24 }, // Sedang (Kelapa Gading)
            { id: 3, omset: 15400000, margin: 38 }, // Tinggi (Kemang)
            { id: 4, omset: 4500000, margin: 12 }, // Rendah (PIK)
        ];

        return branches.map((branch, index) => {
            const mock = mockData[index % mockData.length];
            return {
                ...branch,
                omset: mock.omset,
                margin: mock.margin
            };
        });
    }
}
