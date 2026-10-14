import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { as, asCommit, migrate, newDb, user } from './helpers.mjs'

const DENIED = /permission denied/

/** Base con migraciones hasta 005 y un equipo: admin, gerente y los asesores indicados. */
async function team(asesores = [['ana', 1], ['beto', 1]]) {
  const db = await newDb({ upTo: '005_crm_functions.sql' })
  const u = {}, adv = {}
  const add = async (key, name, role, weight = 1, active = true) => {
    u[key] = await user(db, `${key}@kreer.test`)
    adv[key] = (await db.query(
      'insert into advisors (name, email, role, user_id, assign_weight, active) values ($1, $2, $3, $4, $5, $6) returning id',
      [name, `${key}@kreer.test`, role, u[key], weight, active],
    )).rows[0].id
  }
  await add('admin', 'Admin', 'admin')
  await add('gerente', 'Gerente', 'gerente')
  for (const [key, w] of asesores) await add(key, key[0].toUpperCase() + key.slice(1), 'asesor', w)
  return { db, u, adv, add }
}

let phoneSeq = 0
const nextPhone = () => String(593910000000 + ++phoneSeq)

/** Llama a submit_lead como visitante sin sesión y conserva el resultado. */
const submit = (db, a = {}) =>
  asCommit(db, { role: 'anon' }, (q) =>
    q('select public.submit_lead($1, $2, $3, $4, $5, $6::uuid, $7::jsonb, $8) as r', [
      a.name ?? 'Cliente', a.email ?? '', 'phone' in a ? a.phone : nextPhone(), a.interest ?? 'comprar',
      a.message ?? '', a.property ?? null, a.utm ? JSON.stringify(a.utm) : null, a.website ?? '',
    ]))

const leadsOf = async (db) => (await db.query(
  'select l.id, l.stage, l.source, l.interest, l.message, l.utm, l.advisor_id, l.property_id, c.name, c.phone, c.email, c.kind from leads l join contacts c on c.id = l.contact_id order by l.created_at, l.id')).rows

describe('005 · formulario público (submit_lead)', () => {
  test('crea contacto y lead asignado, con su historial; el visitante no recibe datos', async () => {
    const { db, adv } = await team()
    const res = await submit(db, { name: 'María', email: 'Maria@Mail.com', phone: '+593 98 765 4321', interest: 'alquilar', message: 'Busco depto', utm: { utm_source: 'instagram' } })
    assert.ok(res.rows[0].r === null || res.rows[0].r === '', 'no devuelve datos (void)')
    const [l] = await leadsOf(db)
    assert.deepEqual(
      [l.name, l.email, l.phone, l.interest, l.source, l.stage, l.message, l.kind],
      ['María', 'maria@mail.com', '593987654321', 'alquilar', 'web', 'nuevo', 'Busco depto', 'cliente'],
    )
    assert.deepEqual(l.utm, { utm_source: 'instagram' })
    assert.ok([adv.ana, adv.beto].includes(l.advisor_id))
    const ev = (await db.query('select kind from lead_events order by created_at, seq')).rows.map((r) => r.kind)
    assert.deepEqual(ev, ['sistema', 'asignacion'])
  })

  test('el interés define el tipo de contacto', async () => {
    const { db } = await team()
    await submit(db, { interest: 'vender' }); await submit(db, { interest: 'invertir' }); await submit(db, { interest: 'comprar' })
    assert.deepEqual((await leadsOf(db)).map((l) => l.kind), ['propietario', 'inversionista', 'cliente'])
  })

  test('acepta solo teléfono o solo correo', async () => {
    const { db } = await team()
    await submit(db, { email: '' }); await submit(db, { phone: null, email: 'solo@mail.com' })
    assert.equal((await leadsOf(db)).length, 2)
  })

  test('el campo trampa (honeypot) descarta el envío sin error', async () => {
    const { db } = await team()
    await submit(db, { website: 'http://spam.example' })
    assert.equal((await leadsOf(db)).length, 0)
  })

  test('datos inválidos se rechazan con un mensaje claro', async () => {
    const { db } = await team()
    const bad = (args, msg) => assert.rejects(submit(db, args), msg)
    await bad({ name: '   ' }, /nombre/)
    await bad({ phone: '123' }, /teléfono no es válido/)
    await bad({ phone: null, email: '' }, /teléfono o un correo/)
    await bad({ email: 'no-es-correo' }, /correo no es válido/)
    await bad({ interest: 'regalar' }, /qué te interesa/)
    assert.equal((await db.query('select count(*)::int n from contacts')).rows[0].n, 0, 'un rechazo no deja basura')
  })

  test('recorta el mensaje, ignora utm raros y propiedades inexistentes', async () => {
    const { db } = await team()
    await submit(db, { message: 'x'.repeat(5000), utm: ['no', 'objeto'], property: '00000000-0000-0000-0000-000000000000' })
    const [l] = await leadsOf(db)
    assert.equal(l.message.length, 2000); assert.equal(l.utm, null); assert.equal(l.property_id, null)
  })

  test('guarda la propiedad consultada', async () => {
    const { db } = await team()
    const p = (await db.query("insert into properties (title, operation, type, price, published) values ('Casa', 'Venta', 'Casa', 1, true) returning id")).rows[0].id
    await submit(db, { property: p })
    assert.equal((await leadsOf(db))[0].property_id, p)
  })
})

describe('005 · normalización de teléfonos', () => {
  test('mismas reglas que la app: dígitos con código de país, Ecuador por defecto', async () => {
    const { db } = await team()
    const norm = async (p) => (await db.query('select public.normalize_phone($1) as n', [p])).rows[0].n
    assert.equal(await norm('0987654321'), '593987654321')
    assert.equal(await norm('987654321'), '593987654321')
    assert.equal(await norm('+593 98 765 4321'), '593987654321')
    assert.equal(await norm('00593987654321'), '593987654321')
    assert.equal(await norm('(02) 234-5678'), '022345678', 'fijo local: se deja igual, como en la app')
    assert.equal(await norm('+1 305 555 0100'), '13055550100')
    assert.equal(await norm('abc'), null)
    assert.equal(await norm(null), null)
  })
})

describe('005 · asignación automática', () => {
  test('reparte en turnos entre asesores activos; admin, gerente e inactivos no reciben', async () => {
    const { db, adv, add } = await team()
    await add('zoe', 'Zoe', 'asesor', 1, false)
    for (let i = 0; i < 6; i++) await submit(db)
    const by = {}
    for (const l of await leadsOf(db)) by[l.advisor_id] = (by[l.advisor_id] ?? 0) + 1
    assert.deepEqual([by[adv.ana], by[adv.beto]], [3, 3])
    assert.equal(Object.keys(by).length, 2)
  })

  test('el reparto alterna desde el primer lead', async () => {
    const { db } = await team()
    for (let i = 0; i < 4; i++) await submit(db)
    const seq = (await leadsOf(db)).map((l) => l.advisor_id)
    assert.notEqual(seq[0], seq[1]); assert.equal(seq[0], seq[2]); assert.equal(seq[1], seq[3])
  })

  test('el peso inclina el reparto (2 a 1)', async () => {
    const { db, adv } = await team([['ana', 2], ['beto', 1]])
    for (let i = 0; i < 6; i++) await submit(db)
    const by = {}
    for (const l of await leadsOf(db)) by[l.advisor_id] = (by[l.advisor_id] ?? 0) + 1
    assert.deepEqual([by[adv.ana], by[adv.beto]], [4, 2])
  })

  test('sin asesores activos el lead queda sin asignar y no falla', async () => {
    const { db } = await team([])
    await submit(db)
    const [l] = await leadsOf(db)
    assert.equal(l.advisor_id, null)
    assert.deepEqual((await db.query('select kind from lead_events')).rows.map((r) => r.kind), ['sistema'])
  })

  test('quien recibe menos leads recibe el siguiente: una asesora nueva se pone al día y luego entra al turno', async () => {
    const { db, adv, add } = await team()
    for (let i = 0; i < 4; i++) await submit(db)                       // Ana 2, Beto 2
    await add('carla', 'Carla', 'asesor')
    for (let i = 0; i < 3; i++) await submit(db)
    const last3 = (await leadsOf(db)).slice(-3).map((l) => l.advisor_id)
    assert.deepEqual(last3.slice(0, 2), [adv.carla, adv.carla], 'Carla parte de 0 y recibe los dos primeros')
    assert.ok([adv.ana, adv.beto].includes(last3[2]), 'empatados en 2, sigue quien lleva más sin recibir')
  })
})

describe('005 · clientes que vuelven a escribir', () => {
  test('mismo teléfono (en cualquier formato) e interés: una nota, no otro lead', async () => {
    const { db } = await team()
    await submit(db, { phone: '0987654321', message: 'primera' })
    await submit(db, { phone: '+593 98 765 4321', message: 'ya me decidí' })
    assert.equal((await leadsOf(db)).length, 1)
    assert.equal((await db.query('select count(*)::int n from contacts')).rows[0].n, 1)
    const notes = (await db.query("select direction, body from lead_events where kind = 'nota'")).rows
    assert.deepEqual(notes, [{ direction: 'entrante', body: 'ya me decidí' }])
  })

  test('mismo correo con otras mayúsculas es el mismo contacto', async () => {
    const { db } = await team()
    await submit(db, { phone: null, email: 'Ana@Mail.com' }); await submit(db, { phone: null, email: 'ana@MAIL.com' })
    assert.equal((await leadsOf(db)).length, 1)
  })

  test('otro interés abre un lead nuevo pero con el mismo asesor', async () => {
    const { db } = await team()
    await submit(db, { phone: '593911112222', interest: 'comprar' })
    for (let i = 0; i < 3; i++) await submit(db) // desbalancea el reparto a propósito
    await submit(db, { phone: '593911112222', interest: 'vender' })
    const mine = (await leadsOf(db)).filter((l) => l.phone === '593911112222')
    assert.equal(mine.length, 2)
    assert.equal(mine[0].advisor_id, mine[1].advisor_id)
  })

  test('si el lead anterior ya se cerró, uno nuevo empieza de cero', async () => {
    const { db } = await team()
    await submit(db, { phone: '593911113333' })
    await db.query("update leads set stage = 'ganado'")
    await submit(db, { phone: '593911113333' })
    const rows = await leadsOf(db)
    assert.deepEqual(rows.map((l) => l.stage), ['ganado', 'nuevo'])
  })

  test('freno: tras 3 repeticiones seguidas se ignoran las siguientes', async () => {
    const { db } = await team()
    for (let i = 0; i < 6; i++) await submit(db, { phone: '593911114444', message: `intento ${i}` })
    assert.equal((await db.query("select count(*)::int n from lead_events where kind = 'nota'")).rows[0].n, 3)
    assert.equal((await leadsOf(db)).length, 1)
  })

  test('completa el dato que faltaba, salvo que ya sea de otro contacto', async () => {
    const { db } = await team()
    await submit(db, { phone: '593911115555', email: '' })
    await submit(db, { phone: '593911115555', email: 'nuevo@mail.com' })
    assert.equal((await db.query("select email from contacts where phone = '593911115555'")).rows[0].email, 'nuevo@mail.com')

    await submit(db, { phone: null, email: 'ocupado@mail.com' })              // otro contacto ya tiene este correo
    await submit(db, { phone: '593911116666', email: '' })
    await submit(db, { phone: '593911116666', email: 'ocupado@mail.com' })    // coincide con dos contactos: no debe fallar
    assert.equal((await db.query('select count(*)::int n from contacts')).rows[0].n, 3)
  })
})

describe('005 · permisos de ejecución', () => {
  test('lo interno no se puede llamar desde la API, ni siquiera con sesión', async () => {
    const { db, u } = await team()
    for (const who of [{ role: 'anon' }, { uid: u.admin }]) {
      await assert.rejects(as(db, who, (q) => q('select public.pick_advisor()')), DENIED)
      await assert.rejects(as(db, who, (q) => q("select public.ingest_lead('A', 'a@a.com', null, 'comprar', 'web')")), DENIED)
    }
  })

  test('un visitante solo puede enviar el formulario', async () => {
    const { db } = await team()
    await assert.rejects(as(db, { role: 'anon' }, (q) => q("select public.create_lead('A', 'a@a.com', null, 'comprar')")), DENIED)
    await assert.rejects(as(db, { role: 'anon' }, (q) => q('select * from public.crm_funnel()')), DENIED)
    await assert.rejects(as(db, { role: 'anon' }, (q) => q('select * from public.crm_metrics(now(), now())')), DENIED)
  })
})

describe('005 · crear leads desde el panel (create_lead)', () => {
  const create = (db, who, a = {}) => asCommit(db, who, (q) =>
    q('select public.create_lead($1, $2, $3, $4, $5, $6, null, $7::uuid) as r', [
      a.name ?? 'Cliente', a.email ?? '', 'phone' in a ? a.phone : nextPhone(), a.interest ?? 'comprar', a.source ?? 'manual', a.message ?? '', a.advisor ?? null,
    ]).then((r) => r.rows[0].r))

  test('un asesor se queda con el lead que crea, y el historial dice quién lo creó', async () => {
    const { db, u, adv } = await team()
    const r = await create(db, { uid: u.ana }, { source: 'referido' })
    assert.equal(r.status, 'created'); assert.equal(r.advisor_id, adv.ana)
    const [l] = await leadsOf(db)
    assert.deepEqual([l.source, l.advisor_id], ['referido', adv.ana])
    const first = (await db.query("select advisor_id from lead_events where kind = 'sistema'")).rows[0]
    assert.equal(first.advisor_id, adv.ana)
  })

  test('un asesor no puede tomar un cliente que ya atiende otro', async () => {
    const { db, u } = await team()
    await create(db, { uid: u.ana }, { phone: '593912223333' })
    await assert.rejects(create(db, { uid: u.beto }, { phone: '593912223333' }), /ya lo atiende Ana/)
    assert.equal((await leadsOf(db)).length, 1)
  })

  test('el mismo asesor que repite un cliente suyo agrega una nota', async () => {
    const { db, u } = await team()
    await create(db, { uid: u.ana }, { phone: '593912224444' })
    const again = await create(db, { uid: u.ana }, { phone: '593912224444', message: 'llamó otra vez' })
    assert.equal(again.status, 'existing')
    assert.equal((await leadsOf(db)).length, 1)
  })

  test('la dirección elige asesor, o deja el reparto automático', async () => {
    const { db, u, adv } = await team()
    const r1 = await create(db, { uid: u.gerente }, { advisor: adv.beto })
    assert.equal(r1.advisor_id, adv.beto)
    const r2 = await create(db, { uid: u.gerente })
    assert.ok([adv.ana, adv.beto].includes(r2.advisor_id))
    await assert.rejects(create(db, { uid: u.admin }, { advisor: '00000000-0000-0000-0000-000000000000' }), /no está disponible/)
  })

  test('la dirección puede registrar a un cliente que ya atiende un asesor (queda como nota)', async () => {
    const { db, u } = await team()
    await create(db, { uid: u.ana }, { phone: '593912225555' })
    const r = await create(db, { uid: u.gerente }, { phone: '593912225555' })
    assert.equal(r.status, 'existing')
  })

  test('quien no es del equipo no crea leads', async () => {
    const { db } = await team()
    const intruso = await user(db, 'intruso@kreer.test')
    await assert.rejects(create(db, { uid: intruso }), /Solo el equipo/)
  })
})

describe('005 · métricas', () => {
  let db, u, adv, from, to
  const at = (d, h = 0, m = 0) => `2026-01-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

  /** Lead con fechas exactas, para que las cifras esperadas sean calculables a mano. */
  async function lead(advisorId, { created, assigned = created, first = null, stage = 'nuevo', closed = null, reason = null }) {
    const c = (await db.query("insert into contacts (name, phone) values ('C', $1) returning id", [nextPhone()])).rows[0].id
    return (await db.query(
      `insert into leads (contact_id, advisor_id, interest, stage, lost_reason, created_at, assigned_at, first_contact_at, closed_at)
       values ($1, $2, 'comprar', $3, $4, $5, $6, $7, $8) returning id`,
      [c, advisorId, stage, reason, created, assigned, first, closed],
    )).rows[0].id
  }
  const event = (leadId, advisorId, kind, when, extra = {}) =>
    db.query('insert into lead_events (lead_id, advisor_id, kind, direction, to_stage, created_at) values ($1, $2, $3, $4, $5, $6)',
      [leadId, advisorId, kind, extra.direction ?? null, extra.to ?? null, when])

  before(async () => {
    ;({ db, u, adv } = await team([['ana', 1], ['beto', 1], ['carla', 1]]))
    from = at(1); to = at(31)

    // Ana: 3 leads recibidos en enero; 2 contactados (30 y 120 min); 1 reasignado después de contactado (se excluye del promedio)
    const a1 = await lead(adv.ana, { created: at(5, 10), assigned: at(5, 10), first: at(5, 10, 30) })
    const a2 = await lead(adv.ana, { created: at(6, 9), assigned: at(6, 9), first: at(6, 11) })
    await lead(adv.ana, { created: at(7, 8) })
    await lead(adv.ana, { created: at(8, 8), assigned: at(8, 12), first: at(8, 9) })         // contactado antes de reasignarse
    // Cerrados en enero (uno nació en diciembre) y uno cerrado en febrero (fuera del periodo)
    await lead(adv.ana, { created: '2025-12-20T00:00:00Z', first: '2025-12-21T00:00:00Z', stage: 'ganado', closed: at(10) })
    await lead(adv.ana, { created: at(3), first: at(3, 1), stage: 'perdido', reason: 'Sin presupuesto', closed: at(12) })
    await lead(adv.ana, { created: at(4), first: at(4, 1), stage: 'ganado', closed: '2026-02-03T00:00:00Z' })
    // Actividad de Ana
    await event(a1, adv.ana, 'llamada', at(5, 10, 30), { direction: 'saliente' })            // primer contacto: no es seguimiento
    await event(a1, adv.ana, 'llamada', at(6, 9), { direction: 'saliente' })                 // llamada + seguimiento
    await event(a1, adv.ana, 'whatsapp', at(6, 10), { direction: 'saliente' })               // seguimiento
    await event(a1, adv.ana, 'whatsapp', at(6, 11), { direction: 'entrante' })               // el cliente escribe: no cuenta
    await event(a1, adv.ana, 'visita', at(9, 15))                                            // visita + seguimiento
    await event(a1, adv.ana, 'llamada', '2025-12-30T00:00:00Z', { direction: 'saliente' })   // fuera del periodo
    await event(a2, adv.ana, 'cambio_etapa', at(7), { to: 'negociacion' })
    await event(a2, adv.ana, 'cambio_etapa', at(8), { to: 'negociacion' })                   // mismo lead: cuenta una vez
    await event(a2, adv.ana, 'cambio_etapa', at(8), { to: 'cita' })

    // Beto: 1 lead sin contactar. Sin asignar: 2 leads. Carla: sin actividad.
    await lead(adv.beto, { created: at(15) })
    await lead(null, { created: at(16) }); await lead(null, { created: at(17) })
  })

  const metrics = (who) => as(db, who, async (q) => (await q('select * from crm_metrics($1, $2)', [from, to])).rows)
  const row = (rows, name) => rows.find((r) => r.advisor_name === name)

  // Promedio de respuesta = (30 + 120 + 60 + 60) / 4 = 67,5 min: los dos leads cerrados también
  // se contactaron a la hora de llegar; el lead reasignado después de contactado se excluye.
  test('cifras de un asesor (calculadas a mano)', async () => {
    const ana = row(await metrics({ uid: u.gerente }), 'Ana')
    assert.deepEqual(
      { received: ana.received, contacted: ana.contacted, avg: Number(ana.avg_response_minutes), calls: ana.calls, followups: ana.followups, visits: ana.visits, negotiations: ana.negotiations, won: ana.won, lost: ana.lost },
      { received: 6, contacted: 5, avg: 67.5, calls: 2, followups: 3, visits: 1, negotiations: 1, won: 1, lost: 1 },
    )
  })

  test('la dirección ve a todos, incluidos asesores sin actividad y los leads sin asignar', async () => {
    const rows = await metrics({ uid: u.admin })
    assert.deepEqual(rows.map((r) => r.advisor_name), ['Ana', 'Beto', 'Carla', 'Sin asignar'])
    assert.deepEqual([row(rows, 'Beto').received, row(rows, 'Beto').contacted], [1, 0])
    assert.equal(row(rows, 'Beto').avg_response_minutes, null)
    assert.deepEqual([row(rows, 'Carla').received, row(rows, 'Carla').calls], [0, 0])
    assert.equal(row(rows, 'Sin asignar').received, 2)
    assert.equal(row(rows, 'Sin asignar').advisor_id, null)
  })

  test('un asesor solo ve sus propias cifras', async () => {
    const rows = await metrics({ uid: u.beto })
    assert.deepEqual(rows.map((r) => r.advisor_name), ['Beto'])
    assert.equal(rows[0].received, 1)
  })

  test('el periodo acota: sin datos en febrero, todo en cero', async () => {
    const rows = await as(db, { uid: u.gerente }, async (q) =>
      (await q('select * from crm_metrics($1, $2)', ['2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z'])).rows)
    assert.ok(rows.every((r) => r.received === 0 && r.calls === 0 && r.won === 0))
  })

  test('el embudo cuenta lo que cada rol puede ver', async () => {
    const f = (who) => as(db, who, async (q) => Object.fromEntries((await q('select * from crm_funnel()')).rows.map((r) => [r.stage, r.total])))
    const all = await f({ uid: u.gerente })
    assert.deepEqual([all.nuevo, all.ganado, all.perdido], [7, 2, 1])
    const beto = await f({ uid: u.beto })
    assert.deepEqual(beto, { nuevo: 1 })
  })
})

describe('005 · repetición', () => {
  test('ejecutar la migración otra vez no rompe nada', async () => {
    const { db } = await team()
    await submit(db)
    await migrate(db, '005_crm_functions.sql')
    await submit(db)
    assert.equal((await leadsOf(db)).length, 2)
  })
})
