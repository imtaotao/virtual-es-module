Virtual es module for easy operation in the sandbox...

## Feature

- [x] `import`
- [x] `export`
- [x] `import()`
- [x] `import.meta`
- [x] `Circular reference`

## Demo

```html
<!DOCTYPE html>
<html lang="en">
<body>
   <script>
    // Add the environment required by babel
    if (!globalThis.process) globalThis.process = {};
    if (!globalThis.Buffer) globalThis.Buffer = { isBuffer: () => false };
  </script>
  <script src="dist/virtual-esm.umd.js"></script>
  <script type="virtual-module">
    import * as _ from 'https://unpkg.com/lodash-es';
    console.log(_);

    import * as m from './m.js';
    console.log(m);

    import('./m.js').then(mm => {
      console.log(m === mm); // true
    })
  </script>
</body>
</html>
```

```js
// m.js
export const a = 1, b = 2;

export default class App {};

const c = 3;
export {
  c as default,
}

const d = 4;
export {
  d as dd,
}
```

## Not support

The code executed by eval cannot be converted by this scheme.

```js
import m from './m.js';

eval('console.log(m);') // throw error 'm is not defined'
``
