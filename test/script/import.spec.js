describe('import', () => {
  it('one', async () => {
    const code = `
      import dd, { default as dd2, a, b, c, d, fn1, fn2, cls } from './files/export.js';

      expect(dd.length).toBe(1);
      expect(dd[0]).toBe('default');
      expect(dd2 === dd).toBe(true);
      expect(a).toBe(1);
      expect(b).toBe(2);
      expect(c).toBe(3);
      expect(d).toBe(4);
      expect(fn1()).toBe('fn1');
      expect(fn2()).toBe('fn2');
      expect((new cls()).world()).toBe('cls.world');

      setTimeout(() => {
        expect(a).toBe('aa'); 
      });
    `;
    await exec(code);
  });
});
