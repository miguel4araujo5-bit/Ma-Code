import test from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';

function sorted(rows) {
  return [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function createDb(name) {
  const db = new Dexie(name);
  db.version(1).stores({
    records: 'id',
    settings: 'id,&marker'
  });
  await db.open();
  return db;
}

async function snapshot(db) {
  return {
    records: sorted(await db.table('records').toArray()),
    settings: sorted(await db.table('settings').toArray())
  };
}

test('Dexie/IndexedDB rolls back clears and writes when failure occurs after writes', async () => {
  const db = await createDb(`ma-code-agent5-proof-mid-${crypto.randomUUID()}`);
  try {
    await db.transaction('rw', db.records, db.settings, async () => {
      await db.records.bulkPut([
        { id: 'old-1', value: 'preserve-a' },
        { id: 'old-2', value: 'preserve-b' }
      ]);
      await db.settings.put({ id: 'default', marker: 'original' });
    });

    const before = await snapshot(db);

    await assert.rejects(
      db.transaction('rw', db.records, db.settings, async () => {
        await db.records.clear();
        await db.records.bulkPut([
          { id: 'new-1', value: 'temporary' },
          { id: 'new-2', value: 'temporary' }
        ]);
        throw new Error('simulated failure after clear/write');
      }),
      /simulated failure after clear\/write/
    );

    assert.deepEqual(await snapshot(db), before);
  } finally {
    db.close();
    await Dexie.delete(db.name);
  }
});

test('Dexie/IndexedDB aborts the whole transaction when finalization write fails', async () => {
  const db = await createDb(`ma-code-agent5-proof-final-${crypto.randomUUID()}`);
  try {
    await db.transaction('rw', db.records, db.settings, async () => {
      await db.records.bulkPut([
        { id: 'old-1', value: 'preserve-a' },
        { id: 'old-2', value: 'preserve-b' }
      ]);
      await db.settings.put({ id: 'existing', marker: 'reserved-marker' });
    });

    const before = await snapshot(db);

    await assert.rejects(
      db.transaction('rw', db.records, db.settings, async () => {
        await db.records.clear();
        await db.records.bulkPut([
          { id: 'new-1', value: 'temporary' }
        ]);

        // Real IndexedDB constraint failure during the final write.
        // `marker` is unique and already belongs to `existing`.
        await db.settings.add({
          id: 'finalization',
          marker: 'reserved-marker'
        });
      })
    );

    assert.deepEqual(await snapshot(db), before);
  } finally {
    db.close();
    await Dexie.delete(db.name);
  }
});
