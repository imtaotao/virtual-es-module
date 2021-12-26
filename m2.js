console.log('m2', 'chentao');
import aa from './m1.js'

export const name = 'm2';
console.log(aa);
setTimeout(() => {
  // aa = 2;
  console.log(aa);
  eval('console.log(`m2`, eval(`a` + `a`))')
})
