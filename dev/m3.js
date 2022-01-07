import * as m1 from './m1.js';
import m1Default from './m1.js';
import { a, b as bb } from './m1.js';

const aaa = 1;
const tao = m1;

// m1.a = aaa;

function fn() {
  console.log(bb, m1);
  return () => {
    var m1 = 2;
    console.log(m1);
  }
}
fn();

class aaab {}

const obj = {
  [m1Default]: a,
}

console.log(`object${m1.a}`);

export let aa = 1, b = 2;

setTimeout(() => {
  aa = 2;
})

export class abc {
  a() {}
};

// export default aaa;

export function ab () {
  
};

export {
  m1 as default,
  bb as tao1,
}

export {
  tao as tao2,
}

console.log('-------');
console.log(import.meta);