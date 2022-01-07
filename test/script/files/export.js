export var a = 1;
export const b = 2;
export let c = 3,
  d = 4;

export function fn1() {
  return 'fn1';
}
export const fn2 = () => 'fn2';

export class cls {
  world() {
    return 'cls.world';
  }
}

export default ['default'];

setTimeout(() => {
  a = 'aa';
});
