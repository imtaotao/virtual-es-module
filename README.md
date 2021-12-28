Virtual es module for easy operation in the sandbox...

## Feature

- [x] `import`
- [x] `import()`
- [x] `import.meta`
- [x] `Circular reference`

## Demo

```html
<!DOCTYPE html>
<html lang="en">
<body>
  <script type="virtual-module">
    import * as m from './m.js';
    console.log(m);

    import('./m.js').then(mm => {
      console.log(m === mm); // true
    })
  </script>

  <!-- Start -->
  <script src="virtual-esm.umd.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      VirtualModule.startByScriptTag();
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
