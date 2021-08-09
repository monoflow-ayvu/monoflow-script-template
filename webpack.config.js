const path = require('path');
const CompressionPlugin = require("compression-webpack-plugin");
const BrotliPlugin = require('brotli-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  // devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
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