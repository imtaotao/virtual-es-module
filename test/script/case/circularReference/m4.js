import { name } from './m3.js';
import * as m3 from './m3.js';

export const _name = 'm4';

expect(() => name).toThrowError(/.?name.?/g);
expect(() => m3.name).toThrowError(/.?name.?/g);

setTimeout(() => {
  expect(name).toBe('m3');
  expect(m3.name).toBe('m3');
});
