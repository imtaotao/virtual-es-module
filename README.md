## es module

Virtual es module for easy operation in the sandbox...

## feature

[x] `import` statement
[x] `import()` statement
[x] `import.meta`

## Demo

```html
<!DOCTYPE html>
<html lang="en">
<body>
  <script type="virtual-module">
    import * as m from './m.js';
    console.log(m);
  </script>
  <script src="virtual-esm.umd.js"></script>
  <script>
    VirtualModule.startByScriptTag();
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