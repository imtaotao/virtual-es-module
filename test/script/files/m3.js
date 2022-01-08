// m3.js 和 m4.js 用来测试循环引用
import { name as m4name } from './m4.js';
import * as m4 from './m4.js';

export const name = 'm3';

console.log(m4);
