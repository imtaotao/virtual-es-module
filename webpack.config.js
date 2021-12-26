const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const port = 2334;

module.exports = () => ({
  target: 'web',
  entry: {
    index: './lib/index.js',
    // index: './index.js'
  },

  output: {
    filename: 'resource/[name].js',
  },

  devServer: {
    port,
    host: '0.0.0.0',
    hot: true,
    open: true,
    static: ['./'],
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: ['babel-loader'],
        exclude: /node_modules\//,
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: './index.html',
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ]
})