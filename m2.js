import aa, { a } from './m1.js'
import * as m1 from './m1.js';

// aa = 1;
// delete m1.default
// m1.a = 1;
console.log(m1, 'm1');
// Object.defineProperty(m1, 'aac', {
//   value: 11,
// })

setTimeout(() => {
  console.log(Object.isSealed(m1), 222);
})

export const name = 'm2';
// console.log(m1.a, 111);

setTimeout(() => {
  console.log(aa, a, 'chentao');
  // m1.a = 222;
  console.log(m1.a, aa);
  console.log(aa, 'aa');
})

console.log(import.meta, 'cccc');
