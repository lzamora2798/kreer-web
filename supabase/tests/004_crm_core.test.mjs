import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { as, migrate, newDb, user } from './helpers.mjs'

let db, u, adv, n = 0
const RLS = /row-level security/
const DENIED = /permission denied/

/** Contacto + lead de ejemplo (teléfono único). Devuelve sus ids. */
async function lead(advisorId = null, { stage = 'nuevo', reason = null } = {}) {
  const phone = String(593900000000 + ++n)
  const c = (await db.query("insert into contacts (name, phone) values ($1, $2) returning id", [`Cliente ${n}`, phone])).rows[0].id
  const l = (await db.query(
    "insert into leads (contact_id, advisor_id, interest, source, stage, lost_reason) values ($1, $2, 'comprar', 'web', $3, $4) returning id",
    [c, advisorId, stage, reason],
  )).rows[0].id
  return { contact: c, lead: l }
}

const events = (q, leadId) =>
  q('select kind, direction, body, from_stage, to_stage, advisor_id, meta from lead_events where lead_id = $1 order by created_at, seq', [leadId]).then((r) => r.rows)

before(async () => {
  db = await newDb({ upTo: '004_crm_core.sql' })
  u = {}; adv = {}
  for (const [key, name, role] of [['admin', 'Admin', 'admin'], ['gerente', 'Gerente', 'gerente'], ['ana', 'Ana', 'asesor'], ['beto', 'Beto', 'asesor']]) {
    u[key] = await user(db, `${key}@kreer.test`)
    adv[key] = (await db.query(
      'insert into advisors (name, email, role, user_id) values ($1, $2, $3, $4) returning id', [name, `${key}@kreer.test`, role, u[key]],
    )).rows[0].id
  }
})

describe('004 · reglas automáticas del lead', () => {
  test('al crearse deja constancia, y la asignación queda registrada', async () => {
    const sin = await lead(null)
    const con = await lead(adv.ana)
    assert.deepEqual((await events(db.query.bind(db), sin.lead)).map((e) => e.kind), ['sistema'])
    const ev = await events(db.query.bind(db), con.lead)
    assert.deepEqual(ev.map((e) => e.kind), ['sistema', 'asignacion'])
    assert.equal(ev[1].meta.to_name, 'Ana')
    const row = (await db.query('select assigned_at, first_contact_at, closed_at from leads where id = $1', [con.lead])).rows[0]
    assert.ok(row.assigned_at); assert.equal(row.first_contact_at, null); assert.equal(row.closed_at, null)
  })

  test('cada cambio de etapa queda en el historial, con quién lo hizo', async () => {
    const { lead: id } = await lead(adv.ana)
    await as(db, { uid: u.ana }, async (q) => {
      await q("update leads set stage = 'contactado' where id = $1", [id])
      await q("update leads set stage = 'seguimiento' where id = $1", [id])
      const changes = (await events(q, id)).filter((e) => e.kind === 'cambio_etapa')
      assert.deepEqual(changes.map((e) => [e.from_stage, e.to_stage]), [['nuevo', 'contactado'], ['contactado', 'seguimiento']])
      assert.ok(changes.every((e) => e.advisor_id === adv.ana))
    })
  })

  test('pasar a una etapa de trabajo fija el primer contacto; perder un lead sin contactarlo, no', async () => {
    const a = await lead(adv.ana), b = await lead(adv.ana)
    await as(db, { uid: u.ana }, async (q) => {
      await q("update leads set stage = 'contactado' where id = $1", [a.lead])
      await q("update leads set stage = 'perdido', lost_reason = 'Spam' where id = $1", [b.lead])
      const get = async (id) => (await q('select first_contact_at, closed_at, lost_reason from leads where id = $1', [id])).rows[0]
      assert.ok((await get(a.lead)).first_contact_at)
      const lost = await get(b.lead)
      assert.equal(lost.first_contact_at, null)
      assert.ok(lost.closed_at)
      assert.equal((await events(q, b.lead)).at(-1).body, 'Spam')
    })
  })

  test('perdido exige motivo; reabrir limpia cierre y motivo', async () => {
    const { lead: id } = await lead(adv.ana)
    await assert.rejects(db.query("update leads set stage = 'perdido' where id = $1", [id]), /leads_lost_reason/)
    await assert.rejects(db.query("update leads set stage = 'perdido', lost_reason = '   ' where id = $1", [id]), /leads_lost_reason/)
    await as(db, { uid: u.ana }, async (q) => {
      await q("update leads set stage = 'perdido', lost_reason = 'Sin presupuesto' where id = $1", [id])
      await q("update leads set stage = 'seguimiento' where id = $1", [id])
      const r = (await q('select closed_at, lost_reason from leads where id = $1', [id])).rows[0]
      assert.deepEqual([r.closed_at, r.lost_reason], [null, null])
    })
  })

  test('ganar un lead lo cierra', async () => {
    const { lead: id } = await lead(adv.ana)
    await as(db, { uid: u.ana }, async (q) => {
      await q("update leads set stage = 'ganado' where id = $1", [id])
      assert.ok((await q('select closed_at from leads where id = $1', [id])).rows[0].closed_at)
    })
  })

  test('reasignar registra de quién a quién y reinicia assigned_at', async () => {
    const { lead: id } = await lead(adv.ana)
    await db.query("update leads set assigned_at = now() - interval '2 days' where id = $1", [id])
    await as(db, { uid: u.gerente }, async (q) => {
      await q('update leads set advisor_id = $2 where id = $1', [id, adv.beto])
      const e = (await events(q, id)).at(-1)
      assert.equal(e.kind, 'asignacion')
      assert.deepEqual([e.meta.from_name, e.meta.to_name, e.advisor_id], ['Ana', 'Beto', adv.gerente])
      assert.ok((await q("select assigned_at > now() - interval '1 minute' as fresh from leads where id = $1", [id])).rows[0].fresh)
    })
  })

  test('origen, contacto y fecha de creación no se pueden cambiar', async () => {
    const a = await lead(adv.ana), b = await lead(adv.ana)
    await as(db, { uid: u.gerente }, async (q) => {
      await q("update leads set source = 'otro', contact_id = $2, created_at = '2000-01-01' where id = $1", [a.lead, b.contact])
      const r = (await q('select source, contact_id, created_at from leads where id = $1', [a.lead])).rows[0]
      assert.equal(r.source, 'web'); assert.equal(r.contact_id, a.contact); assert.ok(r.created_at.getFullYear() > 2000)
    })
  })

  test('los eventos del asesor actualizan la actividad; solo un contacto saliente cuenta como primer contacto', async () => {
    const { lead: id } = await lead(adv.ana)
    await as(db, { uid: u.ana }, async (q) => {
      const ins = (kind, direction) => q('insert into lead_events (lead_id, advisor_id, kind, direction) values ($1, $2, $3, $4)', [id, adv.ana, kind, direction])
      const first = async () => (await q('select first_contact_at from leads where id = $1', [id])).rows[0].first_contact_at
      await ins('nota', null)
      assert.equal(await first(), null, 'una nota no es contacto')
      await ins('whatsapp', 'entrante')
      assert.equal(await first(), null, 'que el cliente escriba no es contacto del asesor')
      await ins('llamada', 'saliente')
      assert.ok(await first(), 'una llamada saliente sí')
      assert.ok((await q('select last_activity_at >= created_at as ok from leads where id = $1', [id])).rows[0].ok)
    })
    const v = await lead(adv.ana)
    await as(db, { uid: u.ana }, async (q) => {
      await q("insert into lead_events (lead_id, advisor_id, kind) values ($1, $2, 'visita')", [v.lead, adv.ana])
      assert.ok((await q('select first_contact_at from leads where id = $1', [v.lead])).rows[0].first_contact_at, 'una visita sí')
    })
  })
})

describe('004 · cada asesor ve solo lo suyo', () => {
  let L1, L2, L3
  before(async () => { L1 = await lead(adv.ana); L2 = await lead(adv.beto); L3 = await lead(null) })

  const ids = (uid, table, role) => as(db, { uid, role }, async (q) => (await q(`select id from ${table}`)).rows.map((r) => r.id))

  test('leads: Ana ve los suyos, Beto los suyos, la dirección todos', async () => {
    const ana = await ids(u.ana, 'leads'), beto = await ids(u.beto, 'leads')
    assert.ok(ana.includes(L1.lead) && !ana.includes(L2.lead) && !ana.includes(L3.lead))
    assert.ok(beto.includes(L2.lead) && !beto.includes(L1.lead))
    for (const who of [u.gerente, u.admin]) {
      const all = await ids(who, 'leads')
      assert.ok([L1, L2, L3].every((x) => all.includes(x.lead)))
    }
  })

  test('contactos: se ven los de mis leads; uno sin asignar no lo ve ningún asesor', async () => {
    const ana = await ids(u.ana, 'contacts')
    assert.ok(ana.includes(L1.contact) && !ana.includes(L2.contact) && !ana.includes(L3.contact))
    assert.ok((await ids(u.gerente, 'contacts')).includes(L3.contact))
    await db.query('update leads set advisor_id = $2 where id = $1', [L3.lead, adv.ana])
    assert.ok((await ids(u.ana, 'contacts')).includes(L3.contact), 'al asignárselo, Ana ve su contacto')
    await db.query('update leads set advisor_id = null where id = $1', [L3.lead])
  })

  test('historial: se ve el de mis leads y nada más', async () => {
    const ev = await as(db, { uid: u.ana }, async (q) => (await q('select distinct lead_id from lead_events')).rows.map((r) => r.lead_id))
    assert.ok(ev.includes(L1.lead) && !ev.includes(L2.lead) && !ev.includes(L3.lead))
  })

  test('un asesor modifica sus leads, no los ajenos, y no los regala ni los suelta', async () => {
    await as(db, { uid: u.ana }, async (q) => {
      assert.equal((await q("update leads set stage = 'contactado' where id = $1", [L1.lead])).affectedRows, 1)
      assert.equal((await q("update leads set stage = 'contactado' where id = $1", [L2.lead])).affectedRows, 0)
    })
    await assert.rejects(as(db, { uid: u.ana }, (q) => q('update leads set advisor_id = $2 where id = $1', [L1.lead, adv.beto])), RLS)
    await assert.rejects(as(db, { uid: u.ana }, (q) => q('update leads set advisor_id = null where id = $1', [L1.lead])), RLS)
  })

  test('la dirección sí reasigna y borra; el asesor no borra', async () => {
    const x = await lead(adv.ana)
    assert.equal((await as(db, { uid: u.ana }, (q) => q('delete from leads where id = $1', [x.lead]))).affectedRows, 0)
    await as(db, { uid: u.gerente }, async (q) => {
      assert.equal((await q('update leads set advisor_id = $2 where id = $1', [x.lead, adv.beto])).affectedRows, 1)
      assert.equal((await q('delete from leads where id = $1', [x.lead])).affectedRows, 1)
      assert.equal((await events(q, x.lead)).length, 0, 'el historial se va con el lead')
    })
  })

  test('nadie inserta leads directamente desde la API', async () => {
    for (const who of [u.ana, u.gerente, u.admin])
      await assert.rejects(
        as(db, { uid: who }, (q) => q("insert into leads (contact_id, interest) values ($1, 'comprar')", [L1.contact])),
        RLS,
      )
  })

  test('un visitante sin sesión no toca nada del CRM', async () => {
    for (const t of ['contacts', 'leads', 'lead_events', 'tasks'])
      await assert.rejects(as(db, { role: 'anon' }, (q) => q(`select * from ${t}`)), DENIED, t)
    await assert.rejects(as(db, { role: 'anon' }, (q) => q("insert into contacts (name, phone) values ('X', '593911111111')")), DENIED)
  })

  test('un usuario autenticado que no es del equipo tampoco ve nada', async () => {
    const intruso = await user(db, 'intruso@kreer.test')
    for (const t of ['contacts', 'leads', 'lead_events', 'tasks'])
      assert.deepEqual(await ids(intruso, t), [], t)
  })
})

describe('004 · contactos', () => {
  test('un asesor crea contactos propios, no a nombre de otro', async () => {
    await as(db, { uid: u.ana }, async (q) => {
      await q("insert into contacts (name, phone, created_by) values ('Mío', '593911110001', $1)", [adv.ana])
      assert.equal((await q("select count(*)::int n from contacts where name = 'Mío'")).rows[0].n, 1)
    })
    await assert.rejects(as(db, { uid: u.ana }, (q) => q("insert into contacts (name, phone, created_by) values ('Ajeno', '593911110002', $1)", [adv.beto])), RLS)
    await assert.rejects(as(db, { uid: u.ana }, (q) => q("insert into contacts (name, phone) values ('Anónimo', '593911110003')")), RLS)
    await as(db, { uid: u.gerente }, (q) => q("insert into contacts (name, phone) values ('De dirección', '593911110004')"))
  })

  test('Ana edita el contacto de su lead, no el de Beto', async () => {
    const mine = await lead(adv.ana), theirs = await lead(adv.beto)
    await as(db, { uid: u.ana }, async (q) => {
      assert.equal((await q("update contacts set notes = 'ok' where id = $1", [mine.contact])).affectedRows, 1)
      assert.equal((await q("update contacts set notes = 'ok' where id = $1", [theirs.contact])).affectedRows, 0)
    })
  })

  test('restricciones: debe tener teléfono o correo, formato válido y sin duplicados', async () => {
    await assert.rejects(db.query("insert into contacts (name) values ('Sin datos')"), /contacts_reachable/)
    await assert.rejects(db.query("insert into contacts (name, phone) values ('X', '12ab')"), /contacts_phone_check/)
    await db.query("insert into contacts (name, phone, email) values ('Dup', '593922220001', 'Dup@Kreer.test')")
    await assert.rejects(db.query("insert into contacts (name, phone) values ('Dup2', '593922220001')"), /contacts_phone_key/)
    await assert.rejects(db.query("insert into contacts (name, email) values ('Dup3', 'dup@kreer.TEST')"), /contacts_email_key/)
    await db.query("insert into contacts (name, email) values ('Solo correo', 'solo@kreer.test')")
  })

  test('no se puede borrar un contacto que tiene leads', async () => {
    const x = await lead(adv.ana)
    await assert.rejects(as(db, { uid: u.gerente }, (q) => q('delete from contacts where id = $1', [x.contact])), /foreign key/)
  })
})

describe('004 · historial de eventos', () => {
  let L1, L2
  before(async () => { L1 = await lead(adv.ana); L2 = await lead(adv.beto) })
  const add = (uid, advisorId, leadId, kind = 'nota') =>
    as(db, { uid }, (q) => q('insert into lead_events (lead_id, advisor_id, kind, body) values ($1, $2, $3, $4)', [leadId, advisorId, kind, 'x']))

  test('el asesor anota en sus leads; la dirección en cualquiera', async () => {
    await add(u.ana, adv.ana, L1.lead)
    await add(u.ana, adv.ana, L1.lead, 'llamada')
    await add(u.gerente, adv.gerente, L2.lead)
  })

  test('no se anota en leads ajenos, ni a nombre de otro, ni con tipos reservados al sistema', async () => {
    await assert.rejects(add(u.ana, adv.ana, L2.lead), RLS)
    await assert.rejects(add(u.ana, adv.beto, L1.lead), RLS)
    await assert.rejects(add(u.ana, null, L1.lead), RLS)
    for (const kind of ['cambio_etapa', 'asignacion', 'sistema']) await assert.rejects(add(u.admin, adv.admin, L1.lead, kind), RLS, kind)
  })

  test('el historial no se edita ni se borra, ni siquiera por la dirección', async () => {
    for (const who of [u.ana, u.gerente, u.admin]) {
      assert.equal((await as(db, { uid: who }, (q) => q("update lead_events set body = 'cambiado'"))).affectedRows, 0)
      assert.equal((await as(db, { uid: who }, (q) => q('delete from lead_events'))).affectedRows, 0)
    }
  })
})

describe('004 · tareas', () => {
  let L1, L2
  const due = "now() + interval '1 day'"
  before(async () => { L1 = await lead(adv.ana); L2 = await lead(adv.beto) })

  test('el asesor crea tareas propias (created_by se llena solo) y la dirección las crea para cualquiera', async () => {
    await as(db, { uid: u.ana }, async (q) => {
      await q(`insert into tasks (lead_id, advisor_id, title, due_at) values ($1, $2, 'Llamar', ${due})`, [L1.lead, adv.ana])
      assert.equal((await q("select created_by from tasks where title = 'Llamar'")).rows[0].created_by, adv.ana)
    })
    await as(db, { uid: u.gerente }, (q) => q(`insert into tasks (lead_id, advisor_id, title, due_at) values ($1, $2, 'Para Ana', ${due})`, [L1.lead, adv.ana]))
    await as(db, { uid: u.ana }, (q) => q(`insert into tasks (advisor_id, title, due_at) values ($1, 'Sin lead', ${due})`, [adv.ana]))
  })

  test('el asesor no crea tareas para otro ni sobre leads que no ve', async () => {
    await assert.rejects(as(db, { uid: u.ana }, (q) => q(`insert into tasks (advisor_id, title, due_at) values ($1, 'X', ${due})`, [adv.beto])), RLS)
    await assert.rejects(as(db, { uid: u.ana }, (q) => q(`insert into tasks (lead_id, advisor_id, title, due_at) values ($1, $2, 'X', ${due})`, [L2.lead, adv.ana])), RLS)
  })

  test('cada asesor ve y completa solo las suyas; la dirección ve todas', async () => {
    await db.query(`insert into tasks (lead_id, advisor_id, title, due_at) values ($1, $2, 'De Beto', ${due})`, [L2.lead, adv.beto])
    await db.query(`insert into tasks (lead_id, advisor_id, title, due_at) values ($1, $2, 'Llamar', ${due})`, [L1.lead, adv.ana])
    await as(db, { uid: u.ana }, async (q) => {
      const titles = (await q('select title from tasks')).rows.map((r) => r.title)
      assert.ok(titles.includes('Llamar') && !titles.includes('De Beto'))
      assert.equal((await q("update tasks set done_at = now() where title = 'Llamar'")).affectedRows >= 1, true)
      assert.equal((await q("update tasks set done_at = now() where title = 'De Beto'")).affectedRows, 0)
      assert.equal((await q("delete from tasks where title = 'De Beto'")).affectedRows, 0)
    })
    await as(db, { uid: u.gerente }, async (q) => {
      const titles = (await q('select title from tasks')).rows.map((r) => r.title)
      assert.ok(titles.includes('Llamar') && titles.includes('De Beto'))
    })
  })

  test('título y fecha son obligatorios', async () => {
    await assert.rejects(db.query(`insert into tasks (advisor_id, title, due_at) values ($1, '', ${due})`, [adv.ana]), /tasks_title_check/)
    await assert.rejects(db.query("insert into tasks (advisor_id, title) values ($1, 'Sin fecha')", [adv.ana]), /due_at/)
  })
})

describe('004 · avisos en vivo y repetición', () => {
  test('leads está en la publicación de Realtime', async () => {
    const r = await db.query("select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'leads'")
    assert.equal(r.rows.length, 1)
  })

  test('ejecutar la migración otra vez no rompe ni duplica nada', async () => {
    const count = async () => (await db.query('select (select count(*) from leads)::int l, (select count(*) from contacts)::int c')).rows[0]
    const before = await count()
    await migrate(db, '004_crm_core.sql')
    assert.deepEqual(await count(), before)
    const pol = await db.query("select count(*)::int n from pg_policies where tablename = 'leads'")
    assert.equal(pol.rows[0].n, 3)
  })
})
