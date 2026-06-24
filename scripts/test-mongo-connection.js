require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.DATABASE_URL;

if (!uri) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function test() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const dbName = client.db().databaseName;
    console.log('Connected to', dbName);
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

test();
