<div align="center">
<h2>Virtual es module</h2>

[![NPM version](https://img.shields.io/npm/v/virtual-es-module.svg?style=flat-square)](https://www.npmjs.com/package/virtual-es-module)

</div>

Based on the es module implemented by `acorn`, easy to operate in the `sandbox`.


## Demo

```html
<!DOCTYPE html>
<html lang="en">
<body>
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


## API

```js
// Import by url
import { Runtime } from 'virtual-es-module';
const runtime = new Runtime();

const module = await runtime.importByUrl('./a.mjs');
console.log(module);

```

```js
// Import by code
import { Runtime } from 'virtual-es-module';
const runtime = new Runtime();

const module = await runtime.importByCode(`
  import * as m from './a.mjs';
  export default 1;
`);
console.log(module);
```

## Not support

The code executed by eval cannot be converted by this scheme.

```js
import m from './m.js';

eval('console.log(m);') // throw error 'm is not defined'
```
