"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSqlAssertions = runSqlAssertions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), 'server/.env') });
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'yash',
    database: process.env.DB_NAME || 'hostelconnect',
};
async function runSqlAssertions(assertionFilePath) {
    const filePath = assertionFilePath || path_1.default.resolve(process.cwd(), 'tests/assertions.sql');
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`Assertions file not found at ${filePath}`);
    }
    const rawContent = fs_1.default.readFileSync(filePath, 'utf8');
    // Split queries by semicolon while ignoring comments
    const rawQueries = rawContent
        .split(';')
        .map((q) => q.trim())
        .filter((q) => q.length > 0 && !q.startsWith('--') && !/^(\s*--.*)+$/.test(q));
    const connection = await promise_1.default.createConnection(dbConfig);
    const violations = [];
    try {
        for (const queryStr of rawQueries) {
            // Find comment above query if any
            const lines = queryStr.split('\n');
            const assertionName = lines.find((l) => l.includes('ASSERTION:'))?.replace(/--\s*ASSERTION:\s*/i, '').trim() || queryStr.substring(0, 50);
            const [rows] = await connection.query(queryStr);
            if (Array.isArray(rows) && rows.length > 0) {
                violations.push({
                    assertion: assertionName,
                    query: queryStr,
                    violatingRows: rows,
                });
            }
        }
    }
    finally {
        await connection.end();
    }
    return {
        passed: violations.length === 0,
        violations,
    };
}
if (process.argv[1]?.includes('sql-assertion-runner')) {
    runSqlAssertions()
        .then(({ passed, violations }) => {
        if (passed) {
            console.log(' [SQL Assertions] All SQL business rule assertions PASSED with 0 violations.');
            process.exit(0);
        }
        else {
            console.error(` [SQL Assertions] FAILED with ${violations.length} business rule violation(s):`);
            violations.forEach((v, idx) => {
                console.error(`\n--- Violation #${idx + 1}: ${v.assertion} ---`);
                console.error('Offending query:\n', v.query);
                console.error('Violating rows returned:', JSON.stringify(v.violatingRows, null, 2));
            });
            process.exit(1);
        }
    })
        .catch((err) => {
        console.error(' [SQL Assertions] Error executing assertions:', err);
        process.exit(1);
    });
}
