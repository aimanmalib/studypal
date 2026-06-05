// Babel config used ONLY by Jest (via jest.config.js).
// Kept separate from any root babel config so Next.js keeps using its
// faster SWC compiler for dev/build.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
};
