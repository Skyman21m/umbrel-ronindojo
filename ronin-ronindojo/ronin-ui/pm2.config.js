module.exports = {
  apps: [
    {
      name: "RoninUI",
      script: "./node_modules/.bin/next start --port $PORT",
      watch: false,
      env: {
        PORT: 8470,
        NODE_ENV: "production",
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      log_file: "logs/combined.log",
      time: true,
    },
  ],
};
