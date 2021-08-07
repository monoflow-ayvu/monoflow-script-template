import join from 'lodash/join';

when.onEvent = (evt) => {
  platform.log(join(['Hello', 'webpack'], ' '));
}