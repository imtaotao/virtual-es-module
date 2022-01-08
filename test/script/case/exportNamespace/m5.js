import * as m6 from './m6.js';
import * as m7 from './m7.js';
import m6Default from './m6.js';
import { d } from './m6.js';

// 模块对象是不能扩展的
expect(() => {
  m6.toString = () => {};
}).toThrow();
// 模块对象的原型为 null
expect(Object.getPrototypeOf(m6)).toBe(null);

expect(d).toBe(1);
expect(m6Default).toEqual([3]);

expect(Object.keys(m6).length).toBe(10);
expect(m6._name).toBe('m6');
expect(m6.a).toEqual([1]);
expect(m6.b).toEqual([2]);
expect(m6.d).toBe(1);
expect(m6.default).toEqual([3]);
expect(m6.m7Namespace === m7).toBe(true);
expect(m6.n1).toBe('m7');
expect(m6.n2).toBe('m7');
expect(m6.name).toBe('m7');
expect(m6.nn).toBe('m7');
