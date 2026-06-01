// Install: npm install nedb @types/nedb

// backend/config/nedb.js
import Datastore from 'nedb';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create collections as files
const db = {
  users: new Datastore({ 
    filename: path.join(__dirname, '../data/users.db'), 
    autoload: true 
  }),
  products: new Datastore({ 
    filename: path.join(__dirname, '../data/products.db'), 
    autoload: true 
  }),
  sales: new Datastore({ 
    filename: path.join(__dirname, '../data/sales.db'), 
    autoload: true 
  })
};

// NeDB uses MongoDB-like syntax
db.users.find({ username: 'admin' }, (err, docs) => {
  console.log(docs);
});

// Insert
db.users.insert({ username: 'admin', password: 'hash' });

// Update
db.users.update({ _id: id }, { $set: { active: true } });

export default db;