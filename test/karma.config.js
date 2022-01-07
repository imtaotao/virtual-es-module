module.exports = (config) => {
  config.set({
    singleRun: true,
    browsers: ['Chrome'],
    frameworks: ['jasmine'],
    reporters: ['progress', 'mocha'],
    colors: {
      error: 'bgRed',
      info: 'bgGreen',
      success: 'blue',
      warning: 'cyan',
    },
    files: [
      '../dist/virtual-esm.umd.js',
      'script/*.spec.js',
      'script/utils.js',
      {
        pattern: 'script/files/*.js',
        included: false,
      },
    ],
    preprocessors: {
      'script/*.spec.js': ['sourcemap'],
    },
    proxies: {
      '/files': '/base/script/files',
    },
    plugins: [
      'karma-jasmine',
      'karma-mocha-reporter',
      'karma-sourcemap-loader',
      'karma-chrome-launcher',
    ],
  });
};
