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
      {
        pattern: 'script/case/**/*.js',
        included: false,
      },
    ],
    preprocessors: {
      'script/*.spec.js': ['sourcemap'],
    },
    plugins: [
      'karma-jasmine',
      'karma-mocha-reporter',
      'karma-sourcemap-loader',
      'karma-chrome-launcher',
    ],
  });
};
