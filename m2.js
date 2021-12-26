import aa from './m1.js'
import * as m1 from './m1.js';

export const name = 'm2';
console.log(m1, 111);
setTimeout(() => {
  m1.a = 222;
  console.log(m1.a, aa);
  console.log(aa, 'aa');
})
