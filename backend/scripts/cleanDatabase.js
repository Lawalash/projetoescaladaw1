const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const backendEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: backendEnvPath, override: false });
dotenv.config();

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'qw1_relatorios'
} = process.env;

function extrairNomeTabela(row) {
  const key = Object.keys(row || {}).find((column) => /tables?_in/i.test(column));
  return key ? row[key] : undefined;
}

async function main() {
  console.log('🧹 Limpando banco de dados (mantendo tabela de usuários)...');
  let connection;

  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: false
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);

    const [tables] = await connection.query('SHOW TABLES');
    const tablesToClean = tables
      .map(extrairNomeTabela)
      .filter(Boolean)
      .filter((table) => table !== 'usuarios');

    if (!tablesToClean.length) {
      console.log('Nenhuma tabela encontrada para limpeza.');
      return;
    }

    console.log(`Encontradas ${tablesToClean.length} tabelas para limpeza.`);
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tablesToClean) {
      try {
        await connection.query(`TRUNCATE TABLE \`${table}\``);
        console.log(`- Tabela "${table}" zerada.`);
      } catch (error) {
        console.warn(
          `⚠️  Falha ao limpar a tabela "${table}": ${error?.code || error?.message || 'erro desconhecido'}`
        );
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Limpeza concluída. Usuários preservados.');
  } catch (error) {
    console.error('❌ Erro ao limpar banco de dados:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
