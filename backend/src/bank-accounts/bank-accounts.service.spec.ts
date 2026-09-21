import { Test, TestingModule } from '@nestjs/testing';
import { BankAccountsService } from './bank-accounts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BankAccountsService', () => {
  let service: BankAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BankAccountsService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<BankAccountsService>(BankAccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
