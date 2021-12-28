// export * as m1Namespace from './m1.js';
// export { default } from './m1.js';
export * from './m1.js';
export * from './m5.js';
export { name } from './m1.js';
export { name as n1 } from './m1.js';
export { name as nn, name as n2 } from './m1.js';

const d = 1;
export {
  d,
}
export default d;
// export const name = 'm1';

console.log(1);