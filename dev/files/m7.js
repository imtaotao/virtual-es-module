// m3.js 和 m4.js 用来测试循环引用
import { name as m4name } from './m8.js';
import * as m4 from './m8.js';
import * as m5 from '../files/m8.js?a=1';

export const name = 'm3';

console.log(m4 === m5);