const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',           
    host: 'localhost',       
    database: 'cruddb',
    password: process.env.dbpassword, 
    port: 5432,             
});

async function connectToDatabase() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        console.log('Connected to PostgreSQL database at:', res.rows[0].now);
        client.release();
    } catch (err) {
        console.error('Database connection failed:', err);
    }
}

module.exports = { pool, connectToDatabase };