import * as m1 from './m1.js';
import m1Default from './m1.js';
import { a, b as bb } from './m1.js';

const tao = m1;

m1.a = aaa;

function fn() {
  console.log(bb, m1);
  return () => {
    var m1 = 2;
    console.log(m1);
  }
}

class aaab {}

const obj = {
  [m1Default]: a,
}

console.log(`object${m1}`);

export const aa = 1, b = 2;
export class abc {
  a() {}
};

const aaa = 1
export default aaa;

export function ab () {
  
};

// export default [];

// export {
//   m1Default as default,
//   tao as tao1,
// }

exports.a = class abc {
  a() {}
};