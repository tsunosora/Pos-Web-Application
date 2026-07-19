import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

async function errorsFor(obj: any) {
  return validate(plainToInstance(CreateUserDto, obj));
}

describe('CreateUserDto', () => {
  const ok = { name: 'Budi', email: 'budi@toko.com', password: 'Rahasia123', roleId: 2, branchId: 1 };

  it('menerima payload valid', async () => {
    expect(await errorsFor(ok)).toHaveLength(0);
  });

  it('menolak email tidak valid', async () => {
    const e = await errorsFor({ ...ok, email: 'bukan-email' });
    expect(e.some(x => x.property === 'email')).toBe(true);
  });

  it('menolak password terlalu pendek', async () => {
    const e = await errorsFor({ ...ok, password: 'ab1' });
    expect(e.some(x => x.property === 'password')).toBe(true);
  });

  it('menolak password tanpa angka', async () => {
    const e = await errorsFor({ ...ok, password: 'hanyahuruf' });
    expect(e.some(x => x.property === 'password')).toBe(true);
  });
});
