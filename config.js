require('dotenv').config(); // Load environment variables from .env file

// Database configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10), // Convert to integer
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

module.exports = {
    dbConfig
}; 