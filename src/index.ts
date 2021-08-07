import join from 'lodash/join';

when.onEvent = (_evt) => {
  platform.log(join(['Hello', 'webpack'], ' '));
}