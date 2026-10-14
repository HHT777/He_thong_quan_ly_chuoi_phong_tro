function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required integration-test variable: ${name}`);
  return value;
}

module.exports = Object.freeze({
  baseUrl: required("TEST_BASE_URL"),
  landlord: Object.freeze({
    username: required("TEST_LANDLORD_USERNAME"),
    password: required("TEST_LANDLORD_PASSWORD"),
  }),
  tenant: Object.freeze({
    username: required("TEST_TENANT_USERNAME"),
    password: required("TEST_TENANT_PASSWORD"),
  }),
  otherTenant: Object.freeze({
    username: required("TEST_OTHER_TENANT_USERNAME"),
    password: required("TEST_OTHER_TENANT_PASSWORD"),
  }),
  newAccountPassword: required("TEST_NEW_ACCOUNT_PASSWORD"),
});
