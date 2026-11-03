module.exports = {
  apps: [
    {
      name: 'retail-store-3010',
      cwd: './',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev -p 3010',
      interpreter: 'C:/nvm4w/nodejs/node.exe',
      env: { NODE_ENV: 'development' }
    }
  ]
}
