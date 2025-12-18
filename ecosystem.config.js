// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'biffage',
    script: './server/index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development',
      PORT: 3009,
      ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3001'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3009,
      ALLOWED_ORIGINS: 'https://app.biffage.com,https://www.biffage.com,http://localhost:5173',
      GEMINI_API_KEY: 'AIzaSyDeasyUz_ZqSsbfloYY5tUhnPLEmdaYbkw'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};

