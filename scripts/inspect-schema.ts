import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'yash',
  database: process.env.DB_NAME || 'hostelconnect',
};

async function main() {
  const c = await mysql.createConnection(dbConfig);
  try {
    const [tables] = await c.query<any[]>(
      "SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'hostelconnect' AND TABLE_TYPE = 'BASE TABLE'"
    );
    const [tableList] = await c.query<any[]>(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'hostelconnect' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    );
    const [views] = await c.query<any[]>(
      "SELECT COUNT(*) as cnt FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'hostelconnect'"
    );
    const [viewList] = await c.query<any[]>(
      "SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'hostelconnect' ORDER BY TABLE_NAME"
    );
    const [procs] = await c.query<any[]>(
      "SELECT COUNT(*) as cnt FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'hostelconnect' AND ROUTINE_TYPE = 'PROCEDURE'"
    );
    const [procList] = await c.query<any[]>(
      "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'hostelconnect' AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME"
    );
    const [funcs] = await c.query<any[]>(
      "SELECT COUNT(*) as cnt FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'hostelconnect' AND ROUTINE_TYPE = 'FUNCTION'"
    );
    const [funcList] = await c.query<any[]>(
      "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = 'hostelconnect' AND ROUTINE_TYPE = 'FUNCTION' ORDER BY ROUTINE_NAME"
    );
    const [triggers] = await c.query<any[]>(
      "SELECT COUNT(*) as cnt FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'hostelconnect'"
    );
    const [triggerList] = await c.query<any[]>(
      "SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'hostelconnect' ORDER BY TRIGGER_NAME"
    );
    const [events] = await c.query<any[]>(
      "SELECT COUNT(*) as cnt FROM information_schema.EVENTS WHERE EVENT_SCHEMA = 'hostelconnect'"
    );
    const [eventList] = await c.query<any[]>(
      "SELECT EVENT_NAME, STATUS FROM information_schema.EVENTS WHERE EVENT_SCHEMA = 'hostelconnect' ORDER BY EVENT_NAME"
    );

    console.log(JSON.stringify({
      counts: {
        tables: tables[0].cnt,
        views: views[0].cnt,
        procedures: procs[0].cnt,
        functions: funcs[0].cnt,
        triggers: triggers[0].cnt,
        events: events[0].cnt,
      },
      tableNames: tableList.map((r: any) => r.TABLE_NAME),
      viewNames: viewList.map((r: any) => r.TABLE_NAME),
      procNames: procList.map((r: any) => r.ROUTINE_NAME),
      funcNames: funcList.map((r: any) => r.ROUTINE_NAME),
      triggerList: triggerList,
      eventList: eventList,
    }, null, 2));
  } finally {
    await c.end();
  }
}

main().catch(console.error);
