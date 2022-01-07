import * as t from './m8.js'
console.log(t);

export var a = 1;
export const b = 2;
export let c = 3, d = 4;

export function fn1() {
  return 'fn1';
}
export const fn2 = () => 'fn2';

export class cls {
  world() {
    return 'cls.world'
  }
}

export default ['default'];

setTimeout(() => {
  a = 'aa';
})

function fn3() {
  return 'fn3';
}

export {
  a as aa,
  fn3 as _fn3,
}