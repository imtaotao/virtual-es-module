import path from 'path';
import json from '@rollup/plugin-json';
import ts from 'rollup-plugin-typescript2';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

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
    __TEST__: false,
    __VERSION__: `"${pkg.version}"`,
    __BROWSER__: Boolean(isUmdBuild),
    __DEV__: isBundlerESMBuild
      ? '(process.env.NODE_ENV !== "production")'
      : !isProductionBuild,
    'process.env.BABEL_TYPES_8_BREAKING': false,
  });
}

function createConfig(format, output) {
  output.externalLiveBindings = false;
  const input = path.resolve(__dirname, 'src/index.js');
  const isUmdBuild = /umd/.test(format);
  const isBundlerESMBuild = /esm-bundler/.test(format);
  const isProductionBuild = /\.prod\.js$/.test(output.file);
  if (isUmdBuild) output.name = 'VirtualModule';

  const external = isUmdBuild
    ? []
    : [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
      ];

  // 有可能引用外部包，但是外部包有可能没有 esm 版本
  let nodePlugins = [];
  if (format !== 'cjs') {
    nodePlugins = [
      nodeResolve({ preferBuiltins: false, browser: true }),
      commonjs({ sourceMap: false }),
    ];
  }

  const tsPlugin = ts({
    check: true,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'),
    tsconfigOverride: {
      exclude: ['**/__tests__'],
      compilerOptions: {
        declaration: true,
      },
    },
  });

  return {
    input,
    output,
    external,
    plugins: [
      json({
        namedExports: false,
      }),
      tsPlugin,
      createReplacePlugin(isProductionBuild, isUmdBuild, isBundlerESMBuild),
      ...nodePlugins,
    ],
  };
}

export default packageConfigs;
