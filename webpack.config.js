const path = require('path');
const CompressionPlugin = require("compression-webpack-plugin");
const BrotliPlugin = require('brotli-webpack-plugin');

var babelOptions = {
  presets: [
    ['@babel/env', {
      targets: {
        // 'android 4.4'
        ie: 6,
      },
      bugfixes: true,
      spec: true,
      modules: false,
      debug: false,
      useBuiltIns: false,
    }],
  ],
  "plugins": [["@babel/plugin-transform-arrow-functions", { "spec": true }]]
};

module.exports = {
  entry: './src/index.ts',
  target: ['es5'],
  // devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'babel-loader',
            options: babelOptions
          },
          {
            loader: 'ts-loader',
            options: {
              allowTsInNodeModules: true
            },
          }
        ]
        // exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    chunkFormat: 'commonjs',
  },
  optimization: {
    usedExports: true,
  },
  plugins: [
    new CompressionPlugin(),
    new BrotliPlugin({
      // asset: '[path].br',
      // test: /\.(js|css|html|svg)$/,
      // threshold: 10240,
      // minRatio: 0.8
    })
  ]
};