import mongoose from "mongoose";

export default async function teardown(config) {
  const uri = config.metadata.testMongoUri;
  if (!/^mongodb:\/\/127\.0\.0\.1:27018\/lifeline_test_e2e_\d+$/.test(uri))
    throw new Error(
      "Refusing to remove a database outside the local E2E suite.",
    );
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
}
