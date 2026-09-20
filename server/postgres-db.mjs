/* D1-shaped adapter for PostgreSQL/Supabase. It lets the shared API handler
 * keep one query layer while production uses Supabase's transaction pooler. */

const placeholders = query => {
  let index = 0;
  return String(query).replace(/\?/g, () => `$${++index}`);
};

class BoundStatement {
  constructor(client, query, args) { this.client = client; this.query = placeholders(query); this.args = args; }
  async execute(executor = this.client) { return executor.unsafe(this.query, this.args); }
  async first() { const rows = await this.execute(); return rows[0] || null; }
  async all() { return { results: [...await this.execute()] }; }
  async run() { const rows = await this.execute(); return { success: true, changes: Number(rows.count ?? rows.rowCount ?? rows.length ?? 0), results: [...rows] }; }
}

export async function createPostgresDatabase(connectionString, options = {}) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const module = await import('npm:postgres@3.4.5');
  const postgres = module.default;
  const client = postgres(connectionString, { prepare: false, max: Number(options.max || 4), idle_timeout: Number(options.idleTimeout || 20), connect_timeout: Number(options.connectTimeout || 10), ssl: options.ssl || 'require' });
  return {
    kind: 'postgres',
    prepare(query) { return { bind: (...args) => new BoundStatement(client, query, args) }; },
    async batch(statements) {
      return client.begin(async transaction => {
        const results = [];
        for (const statement of statements) results.push(await statement.execute(transaction));
        return results;
      });
    },
    close: () => client.end({ timeout: 5 })
  };
}
