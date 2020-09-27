require('dotenv').config();
const Discord = require('eris').Client;

const connection = new Discord(process.env.TOKEN);
connection.connect();
