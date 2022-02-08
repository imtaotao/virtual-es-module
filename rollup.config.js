import path from 'path';
import json from '@rollup/plugin-json';
import cleanup from 'rollup-plugin-cleanup';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const byBabel = false;
const outputConfigs = {
  cjs: {
    format: 'cjs',
    file: path.resolve(__dirname, 'dist/virtual-esm.cjs.js'),
  },
  'esm-bundler': {
    format: 'es',
    file: path.resolve(__dirname, 'dist/virtual-esm.esm-bundler.js'),
  },
  umd: {
    format: 'umd',
    file: path.resolve(__dirname, 'dist/virtual-esm.umd.js'),
  },
};

const pkg = require(path.resolve(__dirname, 'package.json'));
const packageConfigs = Object.keys(outputConfigs).map((format) =>
  createConfig(format, outputConfigs[format]),
);
packageConfigs.push(
  createConfig('cjs', {
    format: outputConfigs.cjs.format,
    file: path.resolve(__dirname, 'dist/virtual-esm.cjs.prod.js'),
  }),
);

function createReplacePlugin(isProductionBuild, isUmdBuild, isBundlerESMBuild) {
  return replace({
    __VERSION__: `"${pkg.version}"`,
    __BROWSER__: Boolean(isUmdBuild),
    __DEV__: isBundlerESMBuild
      ? '(process.env.NODE_ENV !== "production")'
      : !isProductionBuild,
  });
}

function createConfig(format, output) {
  let external = [];
  let nodePlugins = [];
  const isUmdBuild = /umd/.test(format);
  const isBundlerESMBuild = /esm-bundler/.test(format);
  const isProductionBuild = /\.prod\.js$/.test(output.file);
  const input = byBabel
    ? path.resolve(__dirname, 'byBabel/index.js')
    : path.resolve(__dirname, `src/index.ts`);

  output.externalLiveBindings = false;
  if (isUmdBuild) output.name = 'VirtualModule';
  
  if (format !== 'cjs') {
    nodePlugins = [
      nodeResolve({ browser: isUmdBuild }),
      commonjs({ sourceMap: false }),
    ];
  }
  if (!isUmdBuild) {
    external = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ];
  }

  return {
    input,
    output,
    external,
    plugins: [
      cleanup(),
      json({
        namedExports: false,
      }),
      typescript({
        clean: true, // no cache
        typescript: require('typescript'),
        tsconfig: path.resolve(__dirname, './tsconfig.json'),
      }),
      createReplacePlugin(isProductionBuild, isUmdBuild, isBundlerESMBuild),
      ...nodePlugins,
    ],
  };
}

export default packageConfigs;
