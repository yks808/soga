const { createClient } = require("redis");
const redisClient = createClient();

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

redisClient.connect().then(() => {
  console.log("Redis connected successfully");
});

module.exports = redisClient;
