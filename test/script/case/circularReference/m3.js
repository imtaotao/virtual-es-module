// m3.js 和 m4.js 用来测试循环引用
import { _name } from './m4.js';
import { _name as m4name } from './m4.js';
import * as m4 from './m4.js';
import * as _m4 from './m4.js?a=1';
import * as __m4 from './../circularReference/m4.js';

export const name = 'm3';
// 只要最终是一个文件就行，但是带 hash 就代表不是同一个资源了
expect(m4 === _m4).toBe(false);
expect(m4 === __m4).toBe(true);
expect(_name).toBe('m4');
expect(m4name).toBe('m4');
expect(m4._name).toBe('m4');
