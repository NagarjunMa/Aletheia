module.exports = {
  presets: [
    [
      'next/babel',
      {
        'preset-env': {
          targets: {
            browsers: ['> 1%', 'last 2 versions', 'not dead']
          },
          modules: false,
          useBuiltIns: 'usage',
          corejs: 3
        }
      }
    ]
  ],
  plugins: [
    // Production optimizations
    ...(process.env.NODE_ENV === 'production' ? [
      ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }],
      ['babel-plugin-transform-remove-debugger']
    ] : []),

    // Development tools
    ...(process.env.NODE_ENV === 'development' ? [
      ['babel-plugin-react-refresh']
    ] : [])
  ],
  env: {
    test: {
      presets: [
        ['next/babel', {
          'preset-env': {
            targets: { node: 'current' },
            modules: 'commonjs'
          }
        }]
      ],
      plugins: [
        'babel-plugin-transform-modules-commonjs'
      ]
    }
  }
}