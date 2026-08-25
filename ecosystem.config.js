/**
 * PM2 proposal for production. It is versioned here but is not activated by
 * this maintenance change; use it only after the deployment checklist review.
 */
module.exports = {
  apps: [
    {
      name: "qafaseman",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      restart_delay: 5000,
      kill_timeout: 10000,
      max_memory_restart: "512M",
    },
  ],
};
