require("dotenv").config();
require("./config/environment").assertRuntimeAuthConfig();
const app = require("./app");
const sequelize = require("./config/database");
const { initCronJobs } = require("./jobs/cron.jobs");
const { checkSchema } = require("./services/schemaReadiness.service");

const PORT = process.env.PORT || 3001;

// Inspect the existing schema before any optional test/development sync.
sequelize.authenticate()
  .then(async () => {
    console.log("✓ Database connected successfully");
    const schema = await checkSchema();
    app.locals.schemaReady = schema.ready;
    if (!schema.ready) console.error("DB_SCHEMA_OUTDATED missing schema objects:", schema.missing);
    if (schema.ready && process.env.DB_SYNC === "true") {
      await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === "true" });
    }
    console.log(
      schema.ready && process.env.DB_SYNC === "true"
        ? "✓ Database schema synced"
        : "✓ Database schema sync skipped",
    );
    // Do not run jobs against an incomplete schema.
    if (schema.ready) initCronJobs();

    app.listen(PORT, () => {
      console.log(`\n✓ Server is running on port ${PORT}`);
      console.log(`✓ API URL: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("✗ Error syncing database:", err);
    process.exit(1);
  });

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n✓ Shutting down gracefully...");
  sequelize.close();
  process.exit(0);
});
