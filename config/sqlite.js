// Install: npm install sqlite sqlite3 knex objection.js

// backend/config/sqlite.js
import { Model } from 'objection';
import Knex from 'knex';

const knex = Knex({
  client: 'sqlite3',
  connection: {
    filename: './erp_database.sqlite' // Single file database
  },
  useNullAsDefault: true
});

Model.knex(knex);
export default knex;