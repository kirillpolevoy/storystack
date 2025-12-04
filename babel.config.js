module.exports = function (api) {
  // Enable caching for performance, but allow invalidation
  api.cache(true);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  };
};
