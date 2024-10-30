module.exports = {
    apps: [
      {
        name: 'sylentx-api',
        script: 'index.js', // Change this to your main application file
        instances: 'max',
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'production',
        },
      },
    ],
  };